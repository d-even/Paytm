import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ClayCard } from './ClayCard'
import { IconBubble } from './IconBubble'

export type MetricDelta = {
  label: string
  direction: 'up' | 'down' | 'neutral'
}

export type MetricCardProps = {
  label: string
  value: ReactNode
  delta?: MetricDelta
  icon?: ReactNode
  className?: string
}

const deltaClasses: Record<MetricDelta['direction'], string> = {
  up: 'bg-success-wash text-success-ink',
  down: 'bg-caution-wash text-caution-ink',
  neutral: 'bg-accent-wash text-accent-ink',
}

/** KPI tile: label, large figure and an optional trend chip. */
export function MetricCard({ label, value, delta, icon, className }: MetricCardProps) {
  return (
    <ClayCard elevation="soft" padding="md" className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate">{label}</p>
        {icon && <IconBubble size="sm">{icon}</IconBubble>}
      </div>
      <p className="text-[34px] leading-none font-bold tracking-[-0.03em] text-ink tabular-nums">
        {value}
      </p>
      {delta && (
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
            deltaClasses[delta.direction],
          )}
        >
          {delta.direction === 'up' && <ArrowUpRight aria-hidden className="size-3.5" />}
          {delta.direction === 'down' && <ArrowDownRight aria-hidden className="size-3.5" />}
          {delta.label}
        </span>
      )}
    </ClayCard>
  )
}
