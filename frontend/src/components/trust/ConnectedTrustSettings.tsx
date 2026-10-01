import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TrustAutosave, TrustSection } from '../../hooks/useTrustAutosave'
import { ClayButton, ErrorState, Skeleton } from '../ui'
import { ResetTrustButton, SafetyLimitsPanel, TrustModesPanel } from './TrustPanels'

/**
 * One section of the connected Trust Settings. The save status shows beside
 * the section that was just changed; screen readers hear it once, through the
 * page's single status region (see Settings).
 */
export function ConnectedTrustSettings({ trust, section }: { trust: TrustAutosave; section: TrustSection }) {
  const { t } = useTranslation()
  const { query, value, change, status, lastSection } = trust

  // Once loaded, a failed refetch (e.g. after a failed save) keeps the controls on screen.
  if (!value) return query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <Skeleton className="h-64 rounded-clay" />

  const Panel = section === 'modes' ? TrustModesPanel : SafetyLimitsPanel
  const shownStatus = lastSection === section ? status : null

  return (
    <div className="flex flex-col gap-4">
      <Panel value={value} onChange={(next) => change(next, section)} columns={2} />
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3">
        <ResetTrustButton value={value} scope={section} onChange={(next) => change(next, section)} />
        <div className="ml-auto flex items-center gap-2 text-sm font-medium">
          {shownStatus === 'saving' && (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin text-slate-soft" />
              <span aria-hidden className="text-slate">
                {t('trust.saving')}
              </span>
            </>
          )}
          {shownStatus === 'saved' && (
            <>
              <Check aria-hidden className="size-4 text-success-ink" />
              <span aria-hidden className="text-success-ink">
                {t('trust.saved')}
              </span>
            </>
          )}
          {shownStatus === 'failed' && (
            <>
              <CloudOff aria-hidden className="size-4 text-danger-ink" />
              <span aria-hidden className="text-danger-ink">
                {t('trust.saveFailed')}
              </span>
              <ClayButton variant="ghost" size="sm" onClick={() => change(value, section)}>
                {t('trust.retry')}
              </ClayButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
