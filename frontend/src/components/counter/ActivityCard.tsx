import { CheckCircle2, History, IndianRupee, Receipt, Sparkles, Sunrise, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useActions } from '../../hooks/queries'
import { useNow } from '../../hooks/useNow'
import { getLanguage } from '../../i18n/languages'
import { cn } from '../../lib/cn'
import type { AgentAction } from '../../mocks/types'
import { useCounter, type CounterEventKind, type Line } from '../../store/counter'
import { useSession } from '../../store/session'
import { ClayButton, ClayCard } from '../ui'
import { clockTime, lineText } from './lines'

type Kind = CounterEventKind | 'payment'

type Entry = {
  id: string
  at: number
  kind: Kind
  line: Line
  /** Second line: card or UPI handle and, for returning customers, the visit. */
  detail?: { instrument: string; source: 'card' | 'upi'; visits?: number }
}

const KIND_STYLE: Record<Kind, { icon: LucideIcon; className: string }> = {
  payment: { icon: IndianRupee, className: 'bg-success-wash text-success-ink' },
  agent: { icon: Sparkles, className: 'bg-accent-wash text-accent-ink' },
  decision: { icon: CheckCircle2, className: 'bg-surface-2 text-ink' },
  bill: { icon: Receipt, className: 'bg-well text-slate' },
  briefing: { icon: Sunrise, className: 'bg-caution-wash text-caution-ink' },
}

const SHOWN = 8
const DAY_MS = 24 * 60 * 60_000

/** What the agent did on its own, or asked about, as feed lines. */
function actionEntries(actions: AgentAction[], since: number): Entry[] {
  return actions.flatMap((action): Entry[] => {
    if (action.executedAt && ['auto_done', 'paused', 'undone'].includes(action.status)) {
      const at = new Date(action.executedAt).getTime()
      return at >= since
        ? [{ id: `${action.id}-auto`, at, kind: 'agent', line: { key: 'counter.lines.autoDone', params: { type: action.type, cap: action.costCap } } }]
        : []
    }
    const at = new Date(action.createdAt).getTime()
    if (at < since || action.status === 'completed') return []
    const line: Line = action.loan
      ? { key: 'counter.lines.loanFound', params: { amount: action.loan.amount } }
      : { key: 'counter.lines.suggested', params: { type: action.type } }
    return [{ id: `${action.id}-new`, at, kind: 'agent', line }]
  })
}

/**
 * Agent activity, newest first: today's payments (from the shared store),
 * what the agent did or suggested, and the merchant's own decisions.
 */
export function ActivityCard() {
  const { t, i18n } = useTranslation()
  const language = useSession((s) => s.language)
  const today = useCounter((s) => s.today)
  const events = useCounter((s) => s.events)
  const { data: actions } = useActions()
  const [showAll, setShowAll] = useState(false)
  const now = useNow(60_000)
  const locale = getLanguage(language).htmlLang

  const entries = useMemo(() => {
    const payments: Entry[] = (today?.recent ?? []).map((p) => ({
      id: p.id,
      at: new Date(p.paidAt).getTime(),
      kind: 'payment',
      line: { key: 'counter.lines.paymentIn', params: { amount: p.amount } },
      detail: { instrument: p.instrumentMasked, source: p.source, visits: p.customer.returning ? p.customer.visits : undefined },
    }))
    const fromEvents: Entry[] = events.map((e) => ({ id: e.id, at: e.at, kind: e.kind, line: e.line }))
    return [...payments, ...fromEvents, ...actionEntries(actions ?? [], now - DAY_MS)].sort((a, b) => b.at - a.at)
  }, [today, events, actions, now])

  const shown = showAll ? entries : entries.slice(0, SHOWN)

  return (
    <ClayCard as="section" aria-labelledby="activity-title" padding="none">
      <header className="flex items-center gap-3 px-5 pt-5 sm:px-6">
        <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
          <History className="size-5" />
        </span>
        <h2 id="activity-title" className="text-lg font-bold">
          {t('counter.activity.title')}
        </h2>
      </header>

      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        {entries.length === 0 ? (
          <p className="rounded-2xl bg-well px-4 py-4 text-slate">{t('counter.activity.empty')}</p>
        ) : (
          <ol className="flex flex-col">
            {shown.map((entry, i) => {
              const { icon: Icon, className } = KIND_STYLE[entry.kind]
              return (
                <li key={entry.id} className={cn('flex gap-3 py-3', i > 0 && 'border-t border-line')}>
                  <time dateTime={new Date(entry.at).toISOString()} className="w-[4.5rem] shrink-0 pt-1.5 text-xs font-medium text-slate-soft tabular-nums">
                    {clockTime(entry.at, locale)}
                  </time>
                  <span aria-hidden className={cn('mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg', className)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[15px] leading-snug', entry.kind === 'payment' ? 'font-semibold text-ink' : 'text-ink')}>
                      {lineText(i18n.t, entry.line)}
                    </p>
                    {entry.detail && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate">
                        <span className="tabular-nums">
                          {t(entry.detail.source === 'card' ? 'counter.bill.sourceCard' : 'counter.bill.sourceUpi')} · {entry.detail.instrument}
                        </span>
                        {entry.detail.visits !== undefined && (
                          <span className="rounded-full bg-coral-wash px-2 py-0.5 text-xs font-semibold text-coral-ink">
                            {t('counter.activity.returning', { count: entry.detail.visits })}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {entries.length > SHOWN && (
          <ClayButton variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-2">
            {showAll ? t('counter.activity.showLess') : t('counter.activity.showAll', { count: entries.length })}
          </ClayButton>
        )}
      </div>
    </ClayCard>
  )
}
