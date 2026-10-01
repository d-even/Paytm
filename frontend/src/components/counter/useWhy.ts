import { useId, useState } from 'react'

/** Open state for one "Why?" button and the panel it controls. */
export function useWhy() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return { open, toggle: () => setOpen((o) => !o), panelId }
}

export type WhyState = ReturnType<typeof useWhy>
