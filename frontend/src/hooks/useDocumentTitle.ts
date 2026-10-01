import { useEffect } from 'react'

/** "Page · Vyapaar Mitra" in the browser tab, so each screen is named for screen readers and history. */
export function useDocumentTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} · Vyapaar Mitra` : 'Vyapaar Mitra'
  }, [page])
}
