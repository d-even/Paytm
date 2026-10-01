import { create } from 'zustand'

type UiState = {
  moreOpen: boolean
  setMoreOpen: (open: boolean) => void
}

/** Transient UI state shared across the shell (not persisted). */
export const useUi = create<UiState>()((set) => ({
  moreOpen: false,
  setMoreOpen: (moreOpen) => set({ moreOpen }),
}))
