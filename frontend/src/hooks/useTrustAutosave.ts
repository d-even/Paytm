import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TrustSettings } from '../mocks/types'
import { useTrustSettings, useUpdateTrustSettings } from './queries'

const SAVE_DELAY_MS = 500

export type TrustSection = 'modes' | 'limits'
type SaveStatus = 'saving' | 'saved' | 'failed' | null

/**
 * One autosaving copy of the trust settings for the whole Settings screen.
 * Both sections edit the same draft, so a limit change made right after a mode
 * change can't save stale modes. Quick taps (the spend cap) are batched, and a
 * change still waiting when the screen closes is saved straight away.
 */
export function useTrustAutosave() {
  const { t } = useTranslation()
  const query = useTrustSettings()
  const { mutate, isPending, isError, isSuccess } = useUpdateTrustSettings()
  const [draft, setDraft] = useState<TrustSettings | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [lastSection, setLastSection] = useState<TrustSection>('modes')
  const timer = useRef<number | undefined>(undefined)
  const queued = useRef<TrustSettings | null>(null)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const next = queued.current
    if (!next) return
    queued.current = null
    setWaiting(false)
    // Once saved, show the server copy again, unless something newer replaced
    // the draft meanwhile. A failed save keeps the draft so Retry resends it.
    mutate(next, { onSuccess: () => setDraft((d) => (d === next ? null : d)) })
  }, [mutate])

  useEffect(() => flush, [flush])

  const change = (next: TrustSettings, section: TrustSection) => {
    setDraft(next)
    setLastSection(section)
    setWaiting(true)
    queued.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
  }

  const value = draft ?? query.data
  const status: SaveStatus = isPending || waiting ? 'saving' : isError ? 'failed' : isSuccess ? 'saved' : null
  const statusText =
    status === 'saving' ? t('trust.saving') : status === 'saved' ? t('trust.saved') : status === 'failed' ? t('trust.saveFailed') : ''

  return { query, value, change, status, statusText, lastSection }
}

export type TrustAutosave = ReturnType<typeof useTrustAutosave>
