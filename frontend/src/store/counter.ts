import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { en } from '../i18n/locales/en'
import { api, ApiError } from '../lib/api'
import { localDateKey } from '../lib/date'
import type { ActionType, Bill, Payment, ScannedCard, TodaySummary } from '../mocks/types'

/**
 * The counter's shared store. One payment updates everything that depends on
 * it in a single step: today's sales, the Soundbox caption, the activity feed
 * (which lists today's payments) and `revision`, which Ask Vyapaar Mitra keys
 * its answers on so they refresh. Captions and feed lines are stored as
 * translation keys with values, so switching language rewrites them too.
 */

type PluralFree<K> = K extends `${infer Base}_${'one' | 'other'}` ? Base : K
export type LineKey = `counter.lines.${PluralFree<keyof typeof en.counter.lines>}`

/** Money values are rupees; `type` is shown as the action's name ("the WhatsApp offer"). */
export type LineParams = {
  amount?: number
  cost?: number
  cap?: number
  today?: number
  yesterday?: number
  pct?: number
  visits?: number
  minutes?: number
  count?: number
  name?: string
  day?: string
  type?: ActionType
  /** Free text the agent said (live backend), shown and read as is. */
  text?: string
}

export type Line = { key: LineKey; params?: LineParams }

export type CounterEventKind = 'bill' | 'briefing' | 'agent' | 'decision'
export type CounterEvent = { id: string; at: number; kind: CounterEventKind; line: Line }

export type Caption = {
  id: number
  at: number
  line: Line
  /** Read aloud when voice is on. Bill prompts are only shown. */
  speak: boolean
}

export type BillFlow =
  | { step: 'idle'; error?: 'create'; amount?: number }
  | { step: 'creating'; amount: number }
  | { step: 'awaiting'; bill: Bill; tapping: boolean; error?: 'tap' }
  | { step: 'paid'; payment: Payment }
  | { step: 'expired'; amount: number }

type CounterState = {
  today: TodaySummary | null
  todayError: boolean
  /** Bumped on every payment; anything derived from today's payments refreshes on it. */
  revision: number
  flow: BillFlow
  caption: Caption | null
  /** Today's counter events (bills, briefings, agent runs, decisions), newest first. */
  events: CounterEvent[]
  eventsDate: string
  voiceOn: boolean
  /** True while the Soundbox voice is reading a caption. */
  speaking: boolean

  loadToday: () => Promise<void>
  createBill: (amount: number) => Promise<void>
  tapCard: () => Promise<void>
  cancelBill: () => void
  nextCustomer: () => void
  setVoice: (on: boolean) => void
  /** Shows (and, if `speak`, reads out) a Soundbox line. */
  say: (line: Line, speak?: boolean) => void
  /** Adds a line to today's activity feed. */
  log: (kind: CounterEventKind, line: Line) => void
  /** Merges a fresher summary, e.g. from an agent run. */
  setToday: (today: TodaySummary) => void
  /** A payment that arrived from outside the app: ESP32 card tap or the customer's phone (QR). */
  receivePayment: (payment: Payment, today: TodaySummary) => void
  /** Something the agent said on the Soundbox (loyalty nudge, briefing, offer sent). */
  agentSays: (text: string) => void
  /** Card tapped on the reader with no bill open; shown so it can be linked to a customer. */
  scannedCard: ScannedCard | null
  setScannedCard: (card: ScannedCard | null) => void
}

const MAX_EVENTS = 60

// Each bill gets a token; a late reply for a bill the merchant already left is ignored.
let flowToken = 0
let expiryTimer: number | undefined
let captionId = 0
let eventId = 0

function clearExpiry() {
  window.clearTimeout(expiryTimer)
  expiryTimer = undefined
}

function paymentLine(payment: Payment): Line {
  const { amount, customer } = payment
  if (customer.rewardDue) return { key: 'counter.lines.paidReward', params: { amount, visits: customer.visits } }
  if (customer.returning) return { key: 'counter.lines.paidReturning', params: { amount, visits: customer.visits } }
  return { key: 'counter.lines.paid', params: { amount } }
}

export const useCounter = create<CounterState>()(
  persist(
    (set, get) => {
      const expire = (bill: Bill) => {
        const flow = get().flow
        // A tap already on its way decides for itself (the server refuses it once the bill has expired).
        if (flow.step !== 'awaiting' || flow.bill.id !== bill.id || flow.tapping) return
        flowToken += 1
        set({ flow: { step: 'expired', amount: bill.amount } })
        const line: Line = { key: 'counter.lines.billExpired', params: { amount: bill.amount } }
        get().say(line, false)
        get().log('bill', line)
      }

      const scheduleExpiry = (bill: Bill) => {
        clearExpiry()
        const ms = new Date(bill.expiresAt).getTime() - Date.now()
        expiryTimer = window.setTimeout(() => expire(bill), Math.max(ms, 0))
      }

      return {
        today: null,
        todayError: false,
        revision: 0,
        flow: { step: 'idle' },
        caption: null,
        events: [],
        eventsDate: localDateKey(),
        voiceOn: true,
        speaking: false,

        loadToday: async () => {
          try {
            const today = await api.getToday()
            set({ today, todayError: false })
          } catch {
            set({ todayError: true })
          }
        },

        createBill: async (amount) => {
          const token = ++flowToken
          set({ flow: { step: 'creating', amount } })
          try {
            const bill = await api.createBill({ amount })
            if (token !== flowToken) {
              void api.cancelBill({ billId: bill.id }).catch(() => undefined)
              return
            }
            set({ flow: { step: 'awaiting', bill, tapping: false } })
            get().say({ key: 'counter.lines.billCreated', params: { amount } }, false)
            scheduleExpiry(bill)
          } catch {
            if (token === flowToken) set({ flow: { step: 'idle', error: 'create', amount } })
          }
        },

        tapCard: async () => {
          const flow = get().flow
          if (flow.step !== 'awaiting' || flow.tapping) return
          const token = flowToken
          set({ flow: { ...flow, tapping: true, error: undefined } })
          try {
            const { payment, today } = await api.tapCard({ billId: flow.bill.id })
            if (token !== flowToken) return
            clearExpiry()
            set((s) => ({ flow: { step: 'paid', payment }, today, revision: s.revision + 1 }))
            get().say(paymentLine(payment), true)
          } catch (error) {
            if (token !== flowToken) return
            if (error instanceof ApiError && error.status === 410) {
              set({ flow: { ...flow, tapping: false } })
              expire(flow.bill)
            } else {
              set({ flow: { ...flow, tapping: false, error: 'tap' } })
            }
          }
        },

        cancelBill: () => {
          const flow = get().flow
          if (flow.step === 'creating') {
            flowToken += 1
            set({ flow: { step: 'idle', amount: flow.amount } })
            return
          }
          if (flow.step !== 'awaiting' || flow.tapping) return
          flowToken += 1
          clearExpiry()
          void api.cancelBill({ billId: flow.bill.id }).catch(() => undefined)
          set({ flow: { step: 'idle' } })
          const line: Line = { key: 'counter.lines.billCancelled', params: { amount: flow.bill.amount } }
          get().say(line, false)
          get().log('bill', line)
        },

        nextCustomer: () => {
          flowToken += 1
          clearExpiry()
          set({ flow: { step: 'idle' } })
        },

        setVoice: (voiceOn) => set({ voiceOn }),

        say: (line, speak = true) => set({ caption: { id: ++captionId, at: Date.now(), line, speak } }),

        log: (kind, line) =>
          set((s) => {
            const date = localDateKey()
            const kept = s.eventsDate === date ? s.events : []
            const event: CounterEvent = { id: `evt_${Date.now().toString(36)}_${++eventId}`, at: Date.now(), kind, line }
            return { events: [event, ...kept].slice(0, MAX_EVENTS), eventsDate: date }
          }),

        setToday: (today) => set({ today }),

        receivePayment: (payment, today) => {
          const flow = get().flow
          if (flow.step === 'awaiting' && flow.bill.id === payment.billId) {
            flowToken += 1
            clearExpiry()
            set((s) => ({ flow: { step: 'paid', payment }, today, revision: s.revision + 1 }))
            get().say(paymentLine(payment), true)
            return
          }
          // Already shown (our own "Tap card" reply), or a payment for another bill: just refresh the numbers.
          const known = get().today?.recent.some((p) => p.id === payment.id)
          set((s) => ({ today, revision: known ? s.revision : s.revision + 1 }))
        },

        agentSays: (text) => {
          const line: Line = { key: 'counter.lines.agentSays', params: { text } }
          // Let the payment announcement finish first (speaking cancels the voice), then the nudge.
          const started = Date.now()
          const trySay = () => {
            if (get().speaking && Date.now() - started < 10_000) {
              window.setTimeout(trySay, 250)
              return
            }
            get().say(line, true)
            get().log('agent', line)
          }
          window.setTimeout(trySay, 700)
        },

        scannedCard: null,
        setScannedCard: (scannedCard) => set({ scannedCard }),
      }
    },
    {
      name: 'vm-counter-v1',
      storage: createJSONStorage(() => localStorage),
      // Only preferences and today's feed survive a refresh; an open bill does not.
      partialize: (s) => ({ voiceOn: s.voiceOn, events: s.events, eventsDate: s.eventsDate }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<CounterState> | undefined
        if (!saved) return current
        const sameDay = saved.eventsDate === localDateKey()
        return {
          ...current,
          voiceOn: saved.voiceOn ?? current.voiceOn,
          events: sameDay ? (saved.events ?? []) : [],
          eventsDate: localDateKey(),
        }
      },
    },
  ),
)
