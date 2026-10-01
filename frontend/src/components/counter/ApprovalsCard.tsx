import { ArrowRight, BellRing, Landmark, Lock, Megaphone, Package, Pause, Play, Tag, Undo2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useActionDecision, useActions } from '../../hooks/queries'
import { useNow } from '../../hooks/useNow'
import { getLanguage } from '../../i18n/languages'
import { cn } from '../../lib/cn'
import { formatINR } from '../../lib/format'
import type { ActionDecisionRequest, ActionType, AgentAction, RiskLevel } from '../../mocks/types'
import { useCounter, type Line } from '../../store/counter'
import { useSession } from '../../store/session'
import { ClayButton, ClayCard, ErrorState, Skeleton } from '../ui'
import { clockTime } from './lines'
import { useWhy } from './useWhy'
import { WhyButton, WhyPanel } from './WhyPanel'

const TYPE_ICON: Record<ActionType, LucideIcon> = { marketing: Megaphone, pricing: Tag, reorder: Package, loan: Landmark }
const TYPE_LABEL = {
  marketing: 'counter.approvals.typeMarketing',
  pricing: 'counter.approvals.typePricing',
  reorder: 'counter.approvals.typeReorder',
  loan: 'counter.approvals.typeLoan',
} as const
const RISK_DOT: Record<RiskLevel, string> = { low: 'bg-risk-low', medium: 'bg-risk-medium', high: 'bg-risk-high' }
const RISK_LABEL = {
  low: 'counter.approvals.riskLow',
  medium: 'counter.approvals.riskMedium',
  high: 'counter.approvals.riskHigh',
} as const

/** What a confirmed decision adds to the activity feed. */
function decisionLine(action: AgentAction, { decision }: ActionDecisionRequest): Line {
  switch (decision) {
    case 'approve':
      return action.loan
        ? { key: 'counter.lines.loanApplied', params: { amount: action.loan.amount } }
        : { key: 'counter.lines.approved', params: { type: action.type } }
    case 'reject':
      return { key: 'counter.lines.rejected', params: { type: action.type } }
    case 'pause':
      return { key: 'counter.lines.paused', params: { type: action.type } }
    case 'resume':
      return { key: 'counter.lines.resumed', params: { type: action.type } }
    case 'undo':
      return { key: 'counter.lines.undone', params: { type: action.type } }
  }
}

/**
 * Needs your approval (pending actions) and, underneath, what Mitra did on
 * its own, each with its spend cap, Pause and Undo. Loans only ever offer
 * "Apply", and nothing is applied for without the merchant confirming.
 */
export function ApprovalsCard() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useActions()
  const [failedId, setFailedId] = useState<string | null>(null)
  const decision = useActionDecision((action, request) => useCounter.getState().log('decision', decisionLine(action, request)))

  const decide = (request: ActionDecisionRequest) => {
    setFailedId(null)
    decision.mutate(request, { onError: () => setFailedId(request.actionId) })
  }
  const busyId = decision.isPending ? decision.variables?.actionId : undefined

  const pending = data?.filter((a) => a.status === 'pending') ?? []
  const auto = data?.filter((a) => a.status === 'auto_done' || a.status === 'paused') ?? []

  return (
    <ClayCard as="section" aria-labelledby="approvals-title" padding="none">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
            <BellRing className="size-5" />
          </span>
          <h2 id="approvals-title" className="text-lg font-bold">
            {t('counter.approvals.title')}
          </h2>
          {pending.length > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-xs font-bold text-on-accent">
              {pending.length}
            </span>
          )}
        </div>
        <Link
          to="/actions"
          className="hidden h-12 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent-ink hover:bg-accent-wash sm:inline-flex"
        >
          {t('counter.approvals.seeAll')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </header>

      <div className="flex flex-col gap-3 px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : (
          <>
            {pending.length === 0 ? (
              <p className="rounded-2xl bg-well px-4 py-4 text-slate">{t('counter.approvals.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((action) => (
                  <li key={action.id}>
                    <PendingCard action={action} busy={busyId === action.id} failed={failedId === action.id} onDecide={decide} />
                  </li>
                ))}
              </ul>
            )}

            {auto.length > 0 && (
              <>
                <h3 className="mt-2 text-base font-bold">{t('counter.approvals.autoTitle')}</h3>
                <ul className="flex flex-col gap-3">
                  {auto.map((action) => (
                    <li key={action.id}>
                      <AutoCard action={action} busy={busyId === action.id} failed={failedId === action.id} onDecide={decide} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link
              to="/actions"
              className="inline-flex h-12 items-center gap-1 self-start rounded-full px-3 text-sm font-semibold text-accent-ink hover:bg-accent-wash sm:hidden"
            >
              {t('counter.approvals.seeAll')}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </>
        )}
      </div>
    </ClayCard>
  )
}

type CardProps = {
  action: AgentAction
  busy: boolean
  failed: boolean
  onDecide: (request: ActionDecisionRequest) => void
}

function CardHead({ action }: { action: AgentAction }) {
  const { t } = useTranslation()
  const Icon = TYPE_ICON[action.type]
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-well text-ink">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate">
          <span className="tracking-[0.1em] uppercase">{t(TYPE_LABEL[action.type])}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-well px-2 py-0.5">
            <span aria-hidden className={cn('size-2 rounded-full', RISK_DOT[action.risk])} />
            {t(RISK_LABEL[action.risk])}
          </span>
        </p>
        <h4 lang="en" className="mt-1 leading-snug font-semibold text-ink">
          {action.title}
        </h4>
        <p lang="en" className="mt-0.5 text-sm text-slate">
          {action.summary}
        </p>
      </div>
    </div>
  )
}

function PendingCard({ action, busy, failed, onDecide }: CardProps) {
  const { t } = useTranslation()
  const why = useWhy()
  const [applying, setApplying] = useState(false)
  const loan = action.loan

  return (
    <article className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4">
      <CardHead action={action} />

      <dl className="flex flex-wrap gap-2 text-sm">
        <div className="rounded-xl bg-success-wash px-3 py-1.5">
          <dt className="sr-only">{t('counter.approvals.expected')}</dt>
          <dd lang="en" className="font-medium text-success-ink">
            {action.expectedImpact.label}
          </dd>
        </div>
        {action.costCap !== undefined && (
          <div className="rounded-xl bg-well px-3 py-1.5">
            <dt className="sr-only">{t('counter.approvals.spendCapLabel')}</dt>
            <dd className="font-medium text-ink">{t('counter.approvals.upTo', { amount: formatINR(action.costCap) })}</dd>
          </div>
        )}
      </dl>

      {loan && (
        <p className="flex items-center gap-2 rounded-xl bg-accent-wash px-3 py-2 text-sm font-semibold text-ink">
          <Lock aria-hidden className="size-4 text-accent-ink" />
          {t('counter.approvals.recommendOnly')}
        </p>
      )}

      {loan && applying ? (
        <LoanCheck
          action={action}
          busy={busy}
          onConfirm={() => onDecide({ actionId: action.id, decision: 'approve' })}
          onCancel={() => setApplying(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {loan ? (
            <ClayButton size="sm" onClick={() => setApplying(true)}>
              {t('counter.approvals.apply')}
            </ClayButton>
          ) : (
            <ClayButton
              size="sm"
              aria-disabled={busy || undefined}
              onClick={() => !busy && onDecide({ actionId: action.id, decision: 'approve' })}
            >
              {t('counter.approvals.approve')}
            </ClayButton>
          )}
          <ClayButton
            size="sm"
            variant="secondary"
            aria-disabled={busy || undefined}
            onClick={() => !busy && onDecide({ actionId: action.id, decision: 'reject' })}
          >
            {loan ? t('counter.approvals.notNow') : t('counter.approvals.reject')}
          </ClayButton>
          <WhyButton {...why} className="ml-auto" />
        </div>
      )}

      {failed && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          {t('counter.approvals.failed')}
        </p>
      )}
      <WhyPanel why={action.why} open={why.open} panelId={why.panelId} />
    </article>
  )
}

/** The loan's terms, shown before the merchant confirms "Apply". */
function LoanCheck({ action, busy, onConfirm, onCancel }: { action: AgentAction; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const loan = action.loan!
  const rows: [string, string][] = [
    [t('counter.approvals.loanAmount'), formatINR(loan.amount)],
    [t('counter.approvals.loanEmi'), formatINR(loan.emi)],
    [t('counter.approvals.loanTenure'), t('counter.approvals.loanMonths', { count: loan.tenureMonths })],
    [t('counter.approvals.loanRate'), t('counter.approvals.loanRatePa', { rate: loan.interestRatePa })],
    [t('counter.approvals.loanTotalInterest'), formatINR(loan.totalInterest)],
  ]
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-well p-4">
      <p className="font-semibold text-ink">{t('counter.approvals.loanCheck')}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-slate">{label}</dt>
            <dd className="font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-slate">{t('counter.approvals.loanLender')}</dt>
          <dd lang="en" className="font-semibold text-ink">
            {loan.lender}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-slate">{t('counter.approvals.loanNote')}</p>
      <div className="flex flex-wrap gap-2">
        <ClayButton size="sm" aria-disabled={busy || undefined} onClick={() => !busy && onConfirm()}>
          {t('counter.approvals.loanConfirm')}
        </ClayButton>
        <ClayButton size="sm" variant="secondary" onClick={onCancel}>
          {t('counter.approvals.cancel')}
        </ClayButton>
      </div>
    </div>
  )
}

function AutoCard({ action, busy, failed, onDecide }: CardProps) {
  const { t } = useTranslation()
  const why = useWhy()
  const language = useSession((s) => s.language)
  const now = useNow(15_000)
  const paused = action.status === 'paused'
  const undoLeft = action.undoUntil ? Math.ceil((new Date(action.undoUntil).getTime() - now) / 60_000) : 0
  const canUndo = undoLeft > 0

  return (
    <article className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4">
      <CardHead action={action} />
      <dl className="flex flex-wrap gap-2 text-sm">
        {action.executedAt && (
          <div className="rounded-xl bg-well px-3 py-1.5">
            <dt className="sr-only">{t('counter.approvals.autoTitle')}</dt>
            <dd className="font-medium text-ink">
              {paused ? t('counter.approvals.autoPaused') : t('counter.approvals.autoAt', { time: clockTime(action.executedAt, getLanguage(language).htmlLang) })}
            </dd>
          </div>
        )}
        {action.costCap !== undefined && (
          <div className="rounded-xl bg-well px-3 py-1.5">
            <dt className="sr-only">{t('counter.approvals.spendCapLabel')}</dt>
            <dd className="font-medium text-ink">{t('counter.approvals.spendCap', { amount: formatINR(action.costCap) })}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <ClayButton
          size="sm"
          variant="secondary"
          aria-disabled={busy || undefined}
          onClick={() => !busy && onDecide({ actionId: action.id, decision: paused ? 'resume' : 'pause' })}
          leadingIcon={paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        >
          {paused ? t('counter.approvals.resume') : t('counter.approvals.pause')}
        </ClayButton>
        {canUndo && (
          <ClayButton
            size="sm"
            variant="secondary"
            aria-disabled={busy || undefined}
            onClick={() => !busy && onDecide({ actionId: action.id, decision: 'undo' })}
            leadingIcon={<Undo2 className="size-4" />}
          >
            {t('counter.approvals.undo')}
          </ClayButton>
        )}
        <WhyButton {...why} className="ml-auto" />
      </div>
      <p className="text-sm text-slate-soft">
        {canUndo ? t('counter.approvals.undoLeft', { count: undoLeft }) : t('counter.approvals.undoClosed')}
      </p>
      {failed && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          {t('counter.approvals.failed')}
        </p>
      )}
      <WhyPanel why={action.why} open={why.open} panelId={why.panelId} />
    </article>
  )
}
