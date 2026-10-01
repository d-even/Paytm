import { Landmark, Lock, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatINR } from '../../lib/format'
import { CONTROLLABLE_ACTIONS } from '../../lib/trust'
import type { TrustSettings } from '../../mocks/types'
import { cn } from '../../lib/cn'
import { ACTION_COPY, MODE_SUMMARY } from './copy'

/** A short receipt of what Mitra may and may not do. */
export function TrustSummary({ value, className }: { value: TrustSettings; className?: string }) {
  const { t } = useTranslation()
  const row = 'flex items-center gap-3 py-3'
  return (
    <ul className={cn('flex flex-col divide-y divide-line', className)}>
      {CONTROLLABLE_ACTIONS.map((action) => {
        const copy = ACTION_COPY[action]
        const mode = value.modes[action]
        return (
          <li key={action} className={row}>
            <copy.icon aria-hidden className="size-5 shrink-0 text-accent-ink" />
            <span className="min-w-0 flex-1 font-medium text-ink">{t(copy.title)}</span>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold',
                mode === 'auto' && 'bg-accent-wash text-accent-ink',
                mode === 'ask' && 'bg-surface-2 text-ink',
                mode === 'off' && 'bg-well text-slate',
              )}
            >
              {t(MODE_SUMMARY[mode])}
            </span>
          </li>
        )
      })}
      <li className={row}>
        <Landmark aria-hidden className="size-5 shrink-0 text-accent-ink" />
        <span className="min-w-0 flex-1 font-medium text-ink">{t('trust.loanTitle')}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-sm font-semibold text-on-accent">
          <Lock aria-hidden className="size-3.5" />
          {t('trust.loanLocked')} · {t('trust.loanYouDecide')}
        </span>
      </li>
      <li className={cn(row, 'text-sm text-slate')}>
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-success-ink" />
        {t('trust.summaryLimits', { cap: formatINR(value.campaignSpendCap), minutes: value.undoWindowMinutes })}
      </li>
    </ul>
  )
}
