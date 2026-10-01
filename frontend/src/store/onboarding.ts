import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { RECOMMENDED_TRUST } from '../lib/trust'
import type { TrustSettings } from '../mocks/types'

/**
 * Trust choices made during onboarding, saved with one PUT
 * /agent/settings/trust on the last step. Kept for the tab's lifetime so a
 * refresh mid-onboarding doesn't lose them.
 */
export const useOnboardingDraft = create<{
  trust: TrustSettings
  setTrust: (trust: TrustSettings) => void
  reset: () => void
}>()(
  persist(
    (set) => ({
      trust: RECOMMENDED_TRUST,
      setTrust: (trust) => set({ trust }),
      reset: () => set({ trust: RECOMMENDED_TRUST }),
    }),
    { name: 'vm-onboarding-draft', storage: createJSONStorage(() => sessionStorage) },
  ),
)
