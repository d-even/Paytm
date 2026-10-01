import { localDateKey } from '../lib/date'
import { RECOMMENDED_TRUST } from '../lib/trust'
import type {
  AgentAction,
  Bill,
  Campaign,
  CashflowDay,
  CashflowResponse,
  InsightsResponse,
  LoanOffer,
  Merchant,
  OutcomesResponse,
  Payment,
  RegularsResponse,
  TrustSettings,
} from './types'

/**
 * Seed data for the Ramesh pilot story. Every number that appears on more than
 * one screen is defined once here so the app stays consistent everywhere:
 * yesterday ₹8,400 (−18% vs last Tuesday), 40 regulars, WhatsApp offer
 * auto-sent, 12th-visit reward, Tuesday ₹10,900 (+30%, pilot simulation),
 * cash crunch in 6 days, a reorder and a recommend-only loan waiting.
 */

export const STORY = {
  yesterdaySales: 8_400,
  lastTuesdaySales: 10_240,
  dipPct: -18,
  regularsCount: 40,
  afterSales: 10_900,
  upliftPct: 30,
  cashCrunchInDays: 6,
  spendCap: RECOMMENDED_TRUST.campaignSpendCap,
  undoWindowMinutes: RECOMMENDED_TRUST.undoWindowMinutes,
} as const

export const merchant: Merchant = {
  id: 'PTM-****4821',
  name: 'Ramesh',
  storeName: 'Ramesh Kirana Store',
  category: 'Kirana & groceries',
  city: 'Mumbai',
  phoneMasked: '+91 98•• ••4821',
}

/** A new merchant starts on Mitra's suggested settings (the same ones onboarding preselects). */
export const defaultTrustSettings: TrustSettings = RECOMMENDED_TRUST

/** Standard reducing-balance EMI, rounded to the rupee. */
export function calculateEmi(principal: number, ratePa: number, months: number) {
  const r = ratePa / 12 / 100
  const factor = (1 + r) ** months
  return Math.round((principal * r * factor) / (factor - 1))
}

function buildLoan(): LoanOffer {
  const amount = 50_000
  const tenureMonths = 6
  const interestRatePa = 16
  const emi = calculateEmi(amount, interestRatePa, tenureMonths)
  return {
    lender: 'Paytm lending partner (NBFC)',
    amount,
    tenureMonths,
    interestRatePa,
    emi,
    totalInterest: emi * tenureMonths - amount,
  }
}

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()
const daysFrom = (now: Date, days: number) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

/** The counter Soundbox. Payments carry its ID, but the UI never shows it. */
export const TERMINAL_ID = 'PTSB-MUM-0042177'

/** A usual weekday's takings, used to judge today's pace. */
export const USUAL_DAY_SALES = 11_200

/**
 * Cards that tap at the counter, in turn. Some belong to regulars (their visit
 * count comes from the regulars list); the rest are new shoppers. The first
 * tap is a regular reaching the 12th-visit reward.
 */
export const CARD_POOL: { instrument: string; regularId?: string }[] = [
  { instrument: '•••• 4417', regularId: 'cust_12' },
  { instrument: '•••• 9031' },
  { instrument: '•••• 2268', regularId: 'cust_85' },
  { instrument: '•••• 6620' },
  { instrument: '•••• 7754', regularId: 'cust_09' },
  { instrument: '•••• 3342', regularId: 'cust_64' },
]

export type CounterDb = {
  date: string
  bills: Record<string, { bill: Bill; status: 'open' | 'paid' | 'cancelled' }>
  /** Today's payments, oldest first. */
  payments: Payment[]
  /** Visits by card for shoppers who aren't regulars yet. */
  cardVisits: Record<string, number>
  /** How many cards have tapped so far; picks the next card from CARD_POOL. */
  taps: number
}

export type MockDatabase = {
  insights: InsightsResponse
  actions: AgentAction[]
  campaigns: Campaign[]
  regulars: RegularsResponse
  outcomes: OutcomesResponse
  cashflow: CashflowResponse
  trust: TrustSettings
  counter: CounterDb
}

/** Payments already taken this morning, so the counter opens mid-day like a real shop. */
export function createCounter(now = new Date(), withMorning = true): CounterDb {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const morning: [number, number, Payment['source'], string, string | null, number][] = [
    // minutes ago, amount, source, card or UPI handle, regular, visits
    [150, 180, 'upi', '••••@ybl', null, 1],
    [118, 420, 'card', '•••• 5821', 'Cust ****21', 8],
    [92, 95, 'upi', '••••@paytm', null, 1],
    [64, 640, 'card', '•••• 1937', 'Cust ****37', 12],
    [37, 260, 'upi', '••••@okicici', 'Cust ****46', 5],
    [16, 245, 'card', '•••• 8810', null, 2],
  ]
  const payments: Payment[] = withMorning
    ? morning.map(([ago, amount, source, instrument, masked, visits], i) => ({
        id: `pay_seed_${i}`,
        billId: `bill_seed_${i}`,
        amount,
        source,
        instrumentMasked: instrument,
        terminalId: TERMINAL_ID,
        customer: {
          masked: masked ?? (visits > 1 ? `Cust ****${instrument.slice(-2)}` : 'New customer'),
          visits,
          returning: visits > 1,
          rewardDue: false,
          whatsappOptIn: masked !== null,
        },
        // Never earlier than midnight, so a seed made at 1 am still counts as today.
        paidAt: new Date(Math.max(now.getTime() - ago * 60_000, startOfDay.getTime() + i * 60_000)).toISOString(),
      }))
    : []
  return { date: localDateKey(now), bills: {}, payments, cardVisits: {}, taps: 0 }
}

export function createSeed(now = new Date()): MockDatabase {
  const loan = buildLoan()
  const executedAt = minutesAgo(now, 6)

  const actions: AgentAction[] = [
    {
      id: 'act_reorder_staples',
      type: 'reorder',
      title: 'Reorder rice and atta before stock runs out',
      summary: 'Basmati rice and atta will run out in about 4 days at the current pace.',
      why: {
        dataUsed: ['Last 30 days of UPI sales', 'Item-level sales from POS taps', 'Your last 3 supplier orders'],
        pattern: 'Rice and atta sell 22% faster in the first week of the month.',
        confidence: 0.84,
      },
      expectedImpact: { label: 'Avoids about ₹3,200 of lost sales', rupees: 3_200 },
      risk: 'medium',
      costCap: 6_800,
      status: 'pending',
      recommendOnly: false,
      createdAt: minutesAgo(now, 40),
      reorderItems: [
        { name: 'Basmati rice', quantity: '2 × 25 kg', cost: 4_200 },
        { name: 'Chakki atta', quantity: '4 × 10 kg', cost: 2_600 },
      ],
    },
    {
      id: 'act_loan_offer',
      type: 'loan',
      title: 'Pre-approved working-capital loan',
      summary: `You may qualify for ₹${loan.amount.toLocaleString('en-IN')} to cover the cash gap in ${STORY.cashCrunchInDays} days.`,
      why: {
        dataUsed: ['90 days of steady UPI collections', 'Predicted cashflow for the next 14 days', 'Upcoming supplier payment'],
        pattern: `Balance is forecast to dip below your safety level in ${STORY.cashCrunchInDays} days.`,
        confidence: 0.78,
      },
      expectedImpact: { label: 'Covers the cash gap with room to spare', rupees: loan.amount },
      risk: 'high',
      status: 'pending',
      recommendOnly: true,
      createdAt: minutesAgo(now, 35),
      loan,
    },
    {
      id: 'act_price_match',
      type: 'pricing',
      title: 'Match Maggi 12-pack price with nearby stores',
      summary: 'Nearby stores sell it ₹8 cheaper; your Maggi sales fell 15% this month.',
      why: {
        dataUsed: ['Maggi sales for the last 60 days', 'Local price benchmark (simulated)'],
        pattern: 'Sales dropped after the local price gap widened.',
        confidence: 0.66,
      },
      expectedImpact: { label: 'About ₹900 more sales a month', rupees: 900 },
      risk: 'low',
      status: 'pending',
      recommendOnly: false,
      createdAt: minutesAgo(now, 30),
    },
    {
      id: 'act_tuesday_offer',
      type: 'marketing',
      title: 'Tuesday offer sent to 40 regulars on WhatsApp',
      summary: '10% off (max ₹50) on bills above ₹300, valid next Tuesday.',
      why: {
        dataUsed: ['Last 8 Tuesdays of UPI sales', 'Visit history of your 40 regulars', 'Past offer redemptions'],
        pattern: 'Tuesday sales have been lower than other weekdays for 6 of the last 8 weeks.',
        confidence: 0.88,
      },
      expectedImpact: { label: 'About ₹2,500 extra on Tuesday', rupees: 2_500 },
      risk: 'low',
      costCap: STORY.spendCap,
      status: 'auto_done',
      recommendOnly: false,
      createdAt: minutesAgo(now, 8),
      executedAt,
      undoUntil: new Date(new Date(executedAt).getTime() + STORY.undoWindowMinutes * 60_000).toISOString(),
      campaignId: 'cmp_tuesday_bachat',
    },
    {
      id: 'act_loyalty_12th',
      type: 'marketing',
      title: 'Loyalty reward on 12th visit',
      summary: 'Cust ****37 reached 12 visits; the counter Soundbox prompted a ₹25 reward.',
      why: {
        dataUsed: ['Visit count from UPI handle', 'Your loyalty rule: reward every 12th visit'],
        pattern: 'Regular customer hit the reward milestone.',
        confidence: 0.97,
      },
      expectedImpact: { label: 'Keeps a ₹640/visit regular coming back', rupees: 640 },
      risk: 'low',
      costCap: 25,
      status: 'completed',
      recommendOnly: false,
      createdAt: minutesAgo(now, 60 * 20),
      executedAt: minutesAgo(now, 60 * 20),
      outcome: { label: 'Reward redeemed · ₹640 bill', simulated: false },
    },
    {
      id: 'act_pilot_tuesday',
      type: 'marketing',
      title: 'Pilot: Tuesday WhatsApp offer',
      summary: 'The first automated Tuesday offer from the pilot run.',
      why: {
        dataUsed: ['Tuesday sales, week 1 vs week 2', 'Offer redemptions'],
        pattern: 'Recurring Tuesday dip.',
        confidence: 0.88,
      },
      expectedImpact: { label: '₹2,500 extra on Tuesday', rupees: 2_500 },
      risk: 'low',
      costCap: STORY.spendCap,
      status: 'completed',
      recommendOnly: false,
      createdAt: minutesAgo(now, 60 * 24 * 8),
      executedAt: minutesAgo(now, 60 * 24 * 8),
      outcome: { label: `+${STORY.upliftPct}% Tuesday sales`, changePct: STORY.upliftPct, simulated: true },
    },
  ]

  const insights: InsightsResponse = {
    briefing: {
      date: now.toISOString(),
      greetingName: merchant.name,
      yesterday: {
        dayLabel: 'Tuesday',
        sales: STORY.yesterdaySales,
        comparison: { label: 'last Tuesday', sales: STORY.lastTuesdaySales, changePct: STORY.dipPct },
      },
      reasoning: 'Recurring Tuesday dip',
      spokenSummary: `Namaste ${merchant.name}. Kal ki sale ₹8,400 thi, pichle Mangalwar se 18% kam. Maine 40 regular customers ko WhatsApp offer bhej diya hai. Aapke approval ke liye 3 cheezein hain.`,
    },
    insights: [
      {
        id: 'ins_tuesday_dip',
        kind: 'sales_dip',
        rank: 1,
        title: 'Tuesday sales keep dipping',
        detail: 'I sent a Tuesday offer to your 40 regulars. You can undo it for 30 minutes.',
        impactRupees: 2_500,
        impactLabel: '+₹2,500 expected',
        risk: 'low',
        ctaLabel: 'See offer',
        actionId: 'act_tuesday_offer',
      },
      {
        id: 'ins_cash_crunch',
        kind: 'cash_crunch',
        rank: 2,
        title: `Cash may run short in ${STORY.cashCrunchInDays} days`,
        detail: 'A supplier payment lands before weekend sales come in.',
        impactRupees: -4_600,
        impactLabel: '₹4,600 short',
        risk: 'high',
        ctaLabel: 'See cashflow',
      },
      {
        id: 'ins_reorder',
        kind: 'reorder',
        rank: 3,
        title: 'Rice and atta running low',
        detail: 'About 4 days of stock left. Reorder is ready for your approval.',
        impactRupees: 3_200,
        impactLabel: '₹3,200 sales protected',
        risk: 'medium',
        ctaLabel: 'Review reorder',
        actionId: 'act_reorder_staples',
      },
      {
        id: 'ins_loyalty',
        kind: 'loyalty',
        rank: 4,
        title: '12 regulars haven’t visited this week',
        detail: 'They usually come by Wednesday. The Tuesday offer reaches them too.',
        impactRupees: 3_200,
        impactLabel: '₹3,200 to recover',
        risk: 'low',
        ctaLabel: 'See regulars',
      },
      {
        id: 'ins_credit',
        kind: 'credit',
        rank: 5,
        title: 'You may qualify for a ₹50,000 loan',
        detail: 'Recommendation only. Nothing happens unless you decide.',
        impactRupees: 50_000,
        impactLabel: '₹50,000 available',
        risk: 'high',
        ctaLabel: 'Review eligibility',
        actionId: 'act_loan_offer',
      },
    ],
  }

  const campaigns: Campaign[] = [
    {
      id: 'cmp_tuesday_bachat',
      actionId: 'act_tuesday_offer',
      name: 'Tuesday Bachat Offer',
      channel: 'whatsapp',
      message:
        'Namaste! 🙏 Is Mangalwar Ramesh Kirana Store par ₹300 se zyada ki kharidi par 10% off (max ₹50). Yeh offer sirf aapke liye hai. Milte hain! – Ramesh',
      audience: { label: `${STORY.regularsCount} regular customers`, count: STORY.regularsCount },
      funnel: { sent: 40, delivered: 38, read: 31, redeemed: 14 },
      discountCost: 560,
      extraSales: STORY.afterSales - STORY.yesterdaySales,
      status: 'running',
      simulated: true,
    },
  ]

  const maskedIds = ['37', '12', '85', '09', '64', '21', '50', '73', '46', '18']
  const visits = [12, 11, 10, 9, 9, 8, 7, 6, 5, 4]
  const baskets = [640, 420, 380, 510, 290, 350, 460, 300, 270, 330]
  const regulars: RegularsResponse = {
    total: STORY.regularsCount,
    regulars: maskedIds.map((suffix, i) => ({
      id: `cust_${suffix}`,
      masked: `Cust ****${suffix}`,
      visits: visits[i],
      lastVisit: minutesAgo(now, 60 * 24 * (i % 4) + 60 * (i + 1)),
      avgBasket: baskets[i],
      reward: { status: visits[i] >= 12 ? 'redeemed' : visits[i] === 11 ? 'earned' : 'progress', everyNVisits: 12 },
      consent: i === 6 || i === 9 ? { whatsappOptIn: false } : { whatsappOptIn: true, optedInAt: minutesAgo(now, 60 * 24 * (30 + i * 5)) },
    })),
  }

  const outcomes: OutcomesResponse = {
    headline: {
      label: 'Tuesday sales after the first automated offer',
      before: { label: 'Tue · week 1', sales: STORY.yesterdaySales },
      after: { label: 'Tue · week 2', sales: STORY.afterSales },
      changePct: STORY.upliftPct,
      simulated: true,
    },
    learned: [
      '14 of 40 regulars used the offer; most came between 6 and 8 pm.',
      'Bills with the offer averaged ₹520, well above the ₹300 minimum.',
      'Customers who hadn’t visited for 10+ days responded the most.',
    ],
    nextWeek: [
      'Send the offer at 5 pm instead of 10 am.',
      'Raise the minimum bill to ₹400 to protect margin.',
      'Add the 12 inactive regulars to a gentle reminder.',
    ],
    weekly: [
      { day: 'Mon', week1: 11_200, week2: 11_350 },
      { day: 'Tue', week1: STORY.yesterdaySales, week2: STORY.afterSales },
      { day: 'Wed', week1: 10_800, week2: 10_950 },
      { day: 'Thu', week1: 11_400, week2: 11_500 },
      { day: 'Fri', week1: 12_100, week2: 12_300 },
      { day: 'Sat', week1: 14_800, week2: 15_100 },
      { day: 'Sun', week1: 13_600, week2: 13_900 },
    ],
  }

  // 14-day forecast. A ₹38,000 supplier payment on day 6 pushes the balance to ₹400,
  // ₹4,600 below the ₹5,000 safety level, which is what drives the loan insight.
  const inflows = [10_900, 11_400, 12_100, 14_800, 13_600, 11_200, 8_600, 10_800, 11_400, 12_100, 14_800, 13_600, 11_200, 9_000]
  const outflows = [7_800, 8_200, 8_900, 9_600, 9_100, 8_400, 38_000, 7_900, 8_300, 8_800, 9_500, 9_000, 8_300, 7_700]
  let balance = 7_800
  const days: CashflowDay[] = inflows.map((inflow, i) => {
    balance += inflow - outflows[i]
    return { date: daysFrom(now, i).toISOString(), inflow, outflow: outflows[i], balance }
  })
  const safetyThreshold = 5_000
  const cashflow: CashflowResponse = {
    days,
    shortfallDayIndex: days.findIndex((d) => d.balance < safetyThreshold),
    safetyThreshold,
    reorderActionId: 'act_reorder_staples',
    loanActionId: 'act_loan_offer',
  }

  return { insights, actions, campaigns, regulars, outcomes, cashflow, trust: defaultTrustSettings, counter: createCounter(now) }
}
