import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import type { ActionWhy } from '../../mocks/types'
import type { WhyState } from './useWhy'

/** "Why?" toggle; it opens the panel below with the data used, pattern found and confidence. */
export function WhyButton({ open, toggle, panelId, className }: WhyState & { className?: string }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        'inline-flex h-12 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-wash',
        className,
      )}
    >
      {open ? t('counter.approvals.hideWhy') : t('counter.approvals.why')}
      <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
    </button>
  )
}

export function WhyPanel({ why, open, panelId }: { why: ActionWhy; open: boolean; panelId: string }) {
  const { t } = useTranslation()
  const pct = Math.round(why.confidence * 100)
  return (
    <div id={panelId} hidden={!open} className="rounded-2xl bg-well px-4 py-3 text-sm">
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="font-semibold text-ink">{t('counter.approvals.dataUsed')}</dt>
          <dd>
            <ul lang="en" className="mt-1 list-disc space-y-0.5 pl-5 text-slate">
              {why.dataUsed.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t('counter.approvals.pattern')}</dt>
          <dd lang="en" className="mt-0.5 text-slate">
            {why.pattern}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t('counter.approvals.confidence')}</dt>
          <dd className="mt-1 flex items-center gap-3">
            <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
            <span className="font-semibold text-ink tabular-nums">{pct}%</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
