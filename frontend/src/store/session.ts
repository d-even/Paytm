import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LanguageCode } from '../mocks/types'
import { useOnboardingDraft } from './onboarding'

export type PendingOtp = {
  phone: string
  phoneMasked: string
  /** Epoch ms when the last OTP was sent; drives the resend countdown. */
  sentAt: number
  resendAfterSeconds: number
}

type SessionState = {
  signedIn: boolean
  phone: string | null
  /** Backend session token from OTP sign-in (null with the in-browser mock). */
  token: string | null
  onboarded: boolean
  language: LanguageCode
  /** Set between "send OTP" and "verify", so a refresh keeps the OTP screen. */
  pendingOtp: PendingOtp | null
  /** Numbers that finished onboarding on this device; a new number sees it again. */
  onboardedPhones: string[]
  startOtp: (otp: PendingOtp) => void
  cancelOtp: () => void
  signIn: (phone: string, token?: string | null) => void
  completeOnboarding: () => void
  setLanguage: (language: LanguageCode) => void
  signOut: () => void
}

/** Merchant session and preferences, persisted across reloads. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      signedIn: false,
      phone: null,
      token: null,
      onboarded: false,
      language: 'hinglish',
      pendingOtp: null,
      onboardedPhones: [],
      startOtp: (pendingOtp) => set({ pendingOtp }),
      cancelOtp: () => set({ pendingOtp: null }),
      signIn: (phone, token = null) =>
        set((s) => ({ signedIn: true, phone, token, pendingOtp: null, onboarded: s.onboardedPhones.includes(phone) })),
      completeOnboarding: () =>
        set((s) => ({
          onboarded: true,
          onboardedPhones: s.phone && !s.onboardedPhones.includes(s.phone) ? [...s.onboardedPhones, s.phone] : s.onboardedPhones,
        })),
      setLanguage: (language) => set({ language }),
      // Language stays: it belongs to the device, not the session.
      signOut: () => {
        // Language and which numbers finished onboarding stay on this device.
        useOnboardingDraft.getState().reset()
        set({ signedIn: false, phone: null, token: null, pendingOtp: null })
      },
    }),
    {
      name: 'vm-session-v1',
      version: 2,
      // v1 had no OTP or per-number onboarding; an already onboarded v1 session keeps its number.
      migrate: (persisted) => {
        const old = persisted as Partial<SessionState>
        return {
          ...old,
          pendingOtp: null,
          onboardedPhones: old.onboarded && old.phone ? [old.phone] : [],
        } as SessionState
      },
    },
  ),
)
