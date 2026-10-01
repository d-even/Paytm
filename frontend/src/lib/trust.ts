import type { TrustSettings } from '../mocks/types'

/** Action types the merchant can set to Auto, Ask me first or Off. Loans are never among them. */
export const CONTROLLABLE_ACTIONS = ['marketing', 'pricing', 'reorder'] as const
export type ControllableAction = (typeof CONTROLLABLE_ACTIONS)[number]
export type ControllableMode = TrustSettings['modes'][ControllableAction]

export const TRUST_MODES: ControllableMode[] = ['auto', 'ask', 'off']

/** What Mitra suggests on day one: small offers on their own, everything else asks first. */
export const RECOMMENDED_TRUST: TrustSettings = {
  modes: { marketing: 'auto', pricing: 'ask', reorder: 'ask', loan: 'recommend_only' },
  campaignSpendCap: 600,
  undoWindowMinutes: 30,
}

/** Spend cap per campaign: ₹100 to ₹2,000 in ₹100 steps (40 regulars × ₹50 max discount). */
export const SPEND_CAP = { min: 100, max: 2000, step: 100 }

export const UNDO_WINDOWS = [15, 30, 60, 120] as const

/** The pilot store's regulars, used to make the spend cap concrete. */
export const REGULARS_COUNT = 40

export type TrustScope = 'modes' | 'limits'

export function sameModes(a: TrustSettings, b: TrustSettings) {
  return CONTROLLABLE_ACTIONS.every((k) => a.modes[k] === b.modes[k])
}

export function sameLimits(a: TrustSettings, b: TrustSettings) {
  return a.campaignSpendCap === b.campaignSpendCap && a.undoWindowMinutes === b.undoWindowMinutes
}

/** `value` with one part (the modes, or the limits) put back to Mitra's suggestion. */
export function resetTrust(value: TrustSettings, scope: TrustScope): TrustSettings {
  return scope === 'modes'
    ? { ...value, modes: RECOMMENDED_TRUST.modes }
    : { ...value, campaignSpendCap: RECOMMENDED_TRUST.campaignSpendCap, undoWindowMinutes: RECOMMENDED_TRUST.undoWindowMinutes }
}
