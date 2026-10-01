import { useEffect, useRef } from 'react'

/**
 * Moves focus to the element (usually a heading with tabIndex={-1}) when it
 * mounts, and scrolls to the top, so keyboard and screen-reader users start
 * each new screen or step at its title. Only on mount: later renders never
 * pull focus back.
 */
export function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null)
  const onMount = useRef(enabled)
  useEffect(() => {
    if (!onMount.current) return
    window.scrollTo({ top: 0 })
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}
