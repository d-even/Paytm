import { localDateKey } from '../lib/date'
import { formatINR } from '../lib/format'
import { SPEND_CAP, UNDO_WINDOWS } from '../lib/trust'
import { detectIntent, phrasebooks } from './answers'
import {
  CARD_POOL,
  createCounter,
  createSeed,
  merchant,
  STORY,
  TERMINAL_ID,
  USUAL_DAY_SALES,
  type MockDatabase,
} from './seed'
import type {
  ActionDecisionRequest,
  AgentAction,
  AgentRunReport,
  Bill,
  BillRequest,
  CreateBillRequest,
  OtpRequest,
  OtpResponse,
  OtpVerifyRequest,
  OtpVerifyResponse,
  Payment,
  PaymentResponse,
  QueryRequest,
  QueryResponse,
  TodaySummary,
  TrustSettings,
} from './types'

/**
 * In-browser stand-in for the Vyapaar Mitra backend. Requests are routed by
 * method + path exactly like the real API, with 300–900 ms of simulated
 * latency. State lives in memory and is mirrored to localStorage so approvals,
 * undos and settings survive a page refresh.
 */

const STORAGE_KEY = 'vm-mock-db-v1'

export class MockApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function load(): MockDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Data saved before a part existed (e.g. the counter) gets that part from a fresh seed.
    if (raw) return { ...createSeed(), ...(JSON.parse(raw) as Partial<MockDatabase>) }
  } catch {
    // Storage can be unavailable (private mode); fall back to a fresh seed.
  }
  return createSeed()
}

let db: MockDatabase = load()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Non-fatal: the session just won't survive a refresh.
  }
}

/** Restores the pilot story to its starting state. */
export function resetMockDatabase() {
  db = createSeed()
  persist()
}

const clone = <T,>(value: T): T => structuredClone(value)
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const latency = () => 300 + Math.round(Math.random() * 600)

function findAction(id: string): AgentAction {
  const action = db.actions.find((a) => a.id === id)
  if (!action) throw new MockApiError(404, `Action ${id} not found`)
  return action
}

function applyDecision({ actionId, decision, edits }: ActionDecisionRequest): AgentAction {
  const action = findAction(actionId)
  const now = new Date()
  const campaign = action.campaignId ? db.campaigns.find((c) => c.id === action.campaignId) : undefined

  switch (decision) {
    case 'approve':
      if (action.status !== 'pending') throw new MockApiError(409, 'Only pending actions can be approved')
      if (edits?.costCap !== undefined) action.costCap = edits.costCap
      action.status = 'approved'
      action.executedAt = now.toISOString()
      break
    case 'reject':
      if (action.status !== 'pending') throw new MockApiError(409, 'Only pending actions can be rejected')
      action.status = 'rejected'
      break
    case 'pause':
      if (action.status !== 'auto_done') throw new MockApiError(409, 'Only running actions can be paused')
      action.status = 'paused'
      if (campaign) campaign.status = 'paused'
      break
    case 'resume':
      if (action.status !== 'paused') throw new MockApiError(409, 'Only paused actions can be resumed')
      action.status = 'auto_done'
      if (campaign) campaign.status = 'running'
      break
    case 'undo': {
      if (action.status !== 'auto_done' && action.status !== 'paused') {
        throw new MockApiError(409, 'Only automatic actions can be undone')
      }
      if (action.undoUntil && new Date(action.undoUntil) < now) {
        throw new MockApiError(409, 'The undo window has closed')
      }
      action.status = 'undone'
      if (campaign) campaign.status = 'stopped'
      break
    }
  }
  persist()
  return clone(action)
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/

function maskPhone(phone: string) {
  return `+91 ${phone.slice(0, 2)}******${phone.slice(-2)}`
}

/** Mock OTP: any 10-digit Indian mobile gets a code, and any 6 digits except 000000 verify. */
function sendOtp({ phone }: OtpRequest): OtpResponse {
  if (!INDIAN_MOBILE.test(phone)) throw new MockApiError(422, 'Enter a valid 10-digit mobile number')
  return { phoneMasked: maskPhone(phone), resendAfterSeconds: 30 }
}

function verifyOtp({ phone, otp }: OtpVerifyRequest): OtpVerifyResponse {
  if (!INDIAN_MOBILE.test(phone)) throw new MockApiError(422, 'Enter a valid 10-digit mobile number')
  if (!/^\d{6}$/.test(otp)) throw new MockApiError(422, 'Enter the 6-digit OTP')
  // 000000 plays the part of a wrong OTP so the error state can be seen.
  if (otp === '000000') throw new MockApiError(401, 'Incorrect OTP')
  return { merchant: { ...merchant, phoneMasked: maskPhone(phone) } }
}

function updateTrust(next: TrustSettings): TrustSettings {
  const { min, max, step } = SPEND_CAP
  const cap = next.campaignSpendCap
  if (!Number.isInteger(cap) || cap < min || cap > max || cap % step !== 0) {
    throw new MockApiError(422, `Spend cap must be ₹${min}–₹${max} in steps of ₹${step}`)
  }
  if (!(UNDO_WINDOWS as readonly number[]).includes(next.undoWindowMinutes)) {
    throw new MockApiError(422, `Undo window must be one of ${UNDO_WINDOWS.join(', ')} minutes`)
  }
  // Loans can never be switched to auto, whatever the client sends.
  db.trust = { ...next, modes: { ...next.modes, loan: 'recommend_only' } }
  persist()
  return clone(db.trust)
}

// ---------- Counter ----------

const BILL_SECONDS = 60
const MAX_BILL = 100_000

/** Today's counter state; a new day starts with an empty till. */
function counter() {
  const today = localDateKey()
  if (db.counter.date !== today) {
    db.counter = { ...createCounter(new Date(), false), cardVisits: db.counter.cardVisits, taps: db.counter.taps }
  }
  return db.counter
}

function todaySummary(): TodaySummary {
  const { date, payments } = counter()
  return {
    date,
    sales: payments.reduce((sum, p) => sum + p.amount, 0),
    count: payments.length,
    returning: payments.filter((p) => p.customer.returning).length,
    recent: payments.slice(-20).reverse(),
  }
}

function createBill({ amount }: CreateBillRequest): Bill {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_BILL) {
    throw new MockApiError(422, `Bill amount must be ₹1–₹${MAX_BILL.toLocaleString('en-IN')}`)
  }
  const now = new Date()
  const id = `bill_${now.getTime().toString(36)}`
  const bill: Bill = {
    id,
    amount,
    upiUri: `upi://pay?pa=rameshkirana@paytm&pn=${encodeURIComponent(merchant.storeName)}&am=${amount}.00&cu=INR&tr=${id}`,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + BILL_SECONDS * 1000).toISOString(),
  }
  counter().bills[id] = { bill, status: 'open' }
  persist()
  return bill
}

function openBill(billId: string) {
  const entry = counter().bills[billId]
  if (!entry) throw new MockApiError(404, 'Bill not found')
  if (entry.status !== 'open') throw new MockApiError(409, `Bill already ${entry.status}`)
  if (new Date(entry.bill.expiresAt) < new Date()) {
    entry.status = 'cancelled'
    persist()
    throw new MockApiError(410, 'Bill expired')
  }
  return entry
}

/** Simulates the customer tapping a card on the counter terminal. */
function tapCard({ billId }: BillRequest): PaymentResponse {
  const entry = openBill(billId)
  const state = counter()
  const card = CARD_POOL[state.taps % CARD_POOL.length]
  state.taps += 1

  const regular = card.regularId ? db.regulars.regulars.find((r) => r.id === card.regularId) : undefined
  let visits: number
  if (regular) {
    regular.visits += 1
    regular.lastVisit = new Date().toISOString()
    visits = regular.visits
    if (visits % regular.reward.everyNVisits === 0) regular.reward.status = 'earned'
  } else {
    visits = (state.cardVisits[card.instrument] ?? 0) + 1
    state.cardVisits[card.instrument] = visits
  }

  const payment: Payment = {
    id: `pay_${Date.now().toString(36)}`,
    billId,
    amount: entry.bill.amount,
    source: 'card',
    instrumentMasked: card.instrument,
    terminalId: TERMINAL_ID,
    customer: {
      masked: regular?.masked ?? (visits > 1 ? `Cust ****${card.instrument.slice(-2)}` : 'New customer'),
      visits,
      returning: visits > 1,
      rewardDue: regular ? visits % regular.reward.everyNVisits === 0 : false,
      whatsappOptIn: regular?.consent.whatsappOptIn ?? false,
    },
    paidAt: new Date().toISOString(),
  }
  entry.status = 'paid'
  state.payments.push(payment)
  persist()
  return { payment, today: todaySummary() }
}

function cancelBill({ billId }: BillRequest) {
  const entry = counter().bills[billId]
  if (entry?.status === 'open') entry.status = 'cancelled'
  persist()
  return { ok: true }
}

// ---------- Agent run ----------

const SUGAR_REORDER_ID = 'act_reorder_sugar'

/**
 * "Run agent now": checks today's pace and, the first time, finds that sugar
 * and oil are running low. The new reorder follows the merchant's trust
 * setting: waits for approval, runs automatically (with undo), or is skipped.
 */
function runAgent(): AgentRunReport {
  const now = new Date()
  const today = todaySummary()
  // A usual day's sales spread evenly over shop hours, 8 am to 10 pm.
  const elapsed = Math.min(Math.max((now.getHours() + now.getMinutes() / 60 - 8) / 14, 0.2), 1)
  const expected = Math.round(USUAL_DAY_SALES * elapsed)
  const pacePct = Math.round(((today.sales - expected) / expected) * 100)

  let newAction: AgentAction | null = null
  let skippedType: AgentRunReport['skippedType'] = null
  const mode = db.trust.modes.reorder
  if (!db.actions.some((a) => a.id === SUGAR_REORDER_ID)) {
    if (mode === 'off') {
      skippedType = 'reorder'
    } else {
      const auto = mode === 'auto'
      newAction = {
        id: SUGAR_REORDER_ID,
        type: 'reorder',
        title: 'Reorder sugar and cooking oil',
        summary: 'Sugar and oil are selling faster today; about 2 days of stock left.',
        why: {
          dataUsed: ['Today’s counter payments', 'Item-level sales from POS taps', 'Your current stock estimate'],
          pattern: 'Sugar and oil are selling 35% above a usual weekday.',
          confidence: 0.76,
        },
        expectedImpact: { label: 'Avoids about ₹1,900 of lost sales', rupees: 1_900 },
        risk: 'medium',
        costCap: 3_400,
        status: auto ? 'auto_done' : 'pending',
        recommendOnly: false,
        createdAt: now.toISOString(),
        executedAt: auto ? now.toISOString() : undefined,
        undoUntil: auto ? new Date(now.getTime() + db.trust.undoWindowMinutes * 60_000).toISOString() : undefined,
        reorderItems: [
          { name: 'Sugar', quantity: '2 × 25 kg', cost: 2_200 },
          { name: 'Sunflower oil', quantity: '1 × 15 L', cost: 1_200 },
        ],
      }
      db.actions.unshift(newAction)
      persist()
    }
  }
  return { ranAt: now.toISOString(), today, pacePct, newAction: newAction && clone(newAction), skippedType }
}

// ---------- Ask Mitra ----------

/** Answers in the merchant's language, always paired with a small visual when there is a number to show. */
function answerQuery({ question, language }: QueryRequest): QueryResponse {
  const say = phrasebooks[language] ?? phrasebooks.hinglish
  const { labels } = say
  const today = todaySummary()

  switch (detectIntent(question)) {
    case 'today':
      return today.count === 0
        ? { answer: say.todayEmpty, followUps: [] }
        : {
            answer: say.today({ sales: formatINR(today.sales), payments: today.count, returning: today.returning }),
            card: { type: 'metric', label: labels.todaySoFar, value: formatINR(today.sales), caption: labels.payments(today.count) },
            followUps: [],
          }
    case 'last': {
      const last = today.recent[0]
      if (!last) return { answer: say.lastEmpty, followUps: [] }
      const minutes = Math.floor((Date.now() - new Date(last.paidAt).getTime()) / 60_000)
      return {
        answer: say.last({
          amount: formatINR(last.amount),
          instrument: last.instrumentMasked,
          minutes,
          visits: last.customer.visits,
          returning: last.customer.returning,
        }),
        card: { type: 'metric', label: labels.lastPayment, value: formatINR(last.amount), caption: last.instrumentMasked },
        followUps: [],
      }
    }
    case 'regulars':
      return {
        answer: say.regulars({ returning: today.returning, total: db.regulars.total, thisWeek: 28 }),
        card: { type: 'metric', label: labels.returningToday, value: String(today.returning), caption: labels.ofRegulars(db.regulars.total) },
        followUps: [],
      }
    case 'loan': {
      const loan = db.actions.find((a) => a.loan)?.loan
      return loan
        ? {
            answer: say.loan({ amount: formatINR(loan.amount), emi: formatINR(loan.emi), months: loan.tenureMonths }),
            card: { type: 'metric', label: labels.preApproved, value: formatINR(loan.amount), caption: labels.loanCaption(loan.interestRatePa, loan.tenureMonths) },
            followUps: [],
          }
        : { answer: say.noLoan, followUps: [] }
    }
    case 'offer': {
      const campaign = db.campaigns[0]
      return {
        answer: say.offer({ count: campaign.audience.count, redeemed: campaign.funnel.redeemed, extra: formatINR(campaign.extraSales) }),
        card: { type: 'metric', label: labels.offerRedeemed, value: `${campaign.funnel.redeemed}/${campaign.funnel.sent}`, caption: campaign.name },
        followUps: [],
      }
    }
    case 'dip':
      return {
        answer: say.dip({ sales: formatINR(STORY.yesterdaySales), pct: Math.abs(STORY.dipPct) }),
        card: {
          type: 'bars',
          label: labels.salesLastWeek,
          data: db.outcomes.weekly.map((d) => ({ label: labels.days[d.day as keyof typeof labels.days], value: d.week1, highlight: d.day === 'Tue' })),
        },
        followUps: [],
      }
    default:
      return { answer: say.fallback({ name: merchant.name }), followUps: [] }
  }
}

type Handler = (body: unknown) => unknown

const routes: Record<string, Handler> = {
  'GET /agent/insights': () => db.insights,
  'GET /agent/actions': () => db.actions,
  'POST /agent/action/approve': (body) => applyDecision(body as ActionDecisionRequest),
  'PUT /agent/settings/trust': (body) => updateTrust(body as TrustSettings),
  'GET /agent/settings/trust': () => db.trust,
  'GET /agent/outcomes': () => db.outcomes,
  'GET /agent/cashflow': () => db.cashflow,
  'POST /agent/query': (body) => answerQuery(body as QueryRequest),
  // Mock-only helpers, not part of the documented backend API.
  'POST /agent/run': () => runAgent(),
  'GET /counter/today': () => todaySummary(),
  'POST /counter/bill': (body) => createBill(body as CreateBillRequest),
  'POST /counter/bill/tap': (body) => tapCard(body as BillRequest),
  'POST /counter/bill/cancel': (body) => cancelBill(body as BillRequest),
  'GET /agent/campaigns': () => db.campaigns,
  'GET /agent/regulars': () => db.regulars,
  'GET /merchant/profile': () => merchant,
  'POST /auth/otp': (body) => sendOtp(body as OtpRequest),
  'POST /auth/verify': (body) => verifyOtp(body as OtpVerifyRequest),
}

export async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  await wait(latency())
  const handler = routes[`${method.toUpperCase()} ${path}`]
  if (!handler) throw new MockApiError(404, `No mock route for ${method} ${path}`)
  return clone(handler(body)) as T
}
