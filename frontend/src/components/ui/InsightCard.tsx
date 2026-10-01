import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ClayButton } from './ClayButton'
import { ClayCard } from './ClayCard'
import { IconBubble } from './IconBubble'
import { RiskBadge, type RiskLevel } from './RiskBadge'

export type InsightStatus = 'open' | 'reviewed' | 'dismissed'

export type InsightCardProps = {
  category: string
  title: string
  body: ReactNode
  icon: ReactNode
  risk: RiskLevel
  recommendation?: ReactNode
  primaryLabel?: string
  status?: InsightStatus
  onPrimary?: () => void
  onDismiss?: () => void
  className?: string
}

/**
 * An AI finding with its reasoning, a recommended next step and the trust
 * rule that applies. High-stakes insights always say approval is required.
 */
export function InsightCard({
  category,
  title,
  body,
  icon,
  risk,
  recommendation,
  primaryLabel = 'Review',
  status = 'open',
  onPrimary,
  onDismiss,
  className,
}: InsightCardProps) {
  return (
    <ClayCard
      as="article"
      padding="md"
      interactive={status === 'open'}
      className={cn('flex flex-col gap-5', status === 'dismissed' && 'opacity-60', className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBubble tone={risk === 'high' ? 'caution' : 'cyan'}>{icon}</IconBubble>
          <p className="text-xs font-semibold tracking-[0.12em] whitespace-nowrap text-slate-soft uppercase">{category}</p>
        </div>
        <RiskBadge level={risk} />
      </header>

      <div className="flex flex-col gap-2">
        <h3 className="text-card">{title}</h3>
        <div className="text-slate">{body}</div>
      </div>

      {recommendation && (
        <div className="clay-inset rounded-clay-sm px-4 py-3 text-sm">
          <p className="text-xs font-semibold tracking-[0.12em] text-accent-ink uppercase">Recommended</p>
          <p className="mt-1 font-medium text-ink">{recommendation}</p>
        </div>
      )}

      {risk === 'high' && (
        <p className="text-sm font-medium text-caution-ink">Merchant approval required. Vyapaar Mitra never acts on this alone.</p>
      )}

      {status === 'open' ? (
        (onPrimary || onDismiss) && (
          <div className="mt-auto flex flex-wrap gap-3">
            {onPrimary && (
              <ClayButton size="sm" onClick={onPrimary}>
                {primaryLabel}
              </ClayButton>
            )}
            {onDismiss && (
              <ClayButton size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </ClayButton>
            )}
          </div>
        )
      ) : (
        <p
          role="status"
          className={cn(
            'mt-auto inline-flex items-center gap-2 text-sm font-semibold',
            status === 'reviewed' ? 'text-success-ink' : 'text-slate-soft',
          )}
        >
          {status === 'reviewed' && <Check aria-hidden className="size-4" />}
          {status === 'reviewed' ? 'Marked for review' : 'Dismissed for today'}
        </p>
      )}
    </ClayCard>
  )
}
