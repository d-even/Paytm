import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'cyan' | 'blue' | 'neutral' | 'success' | 'caution'

const toneClasses: Record<Tone, string> = {
  cyan: 'bg-accent-wash text-accent-ink',
  blue: 'bg-accent text-on-accent',
  neutral: 'bg-surface-2 text-ink',
  success: 'bg-success-wash text-success-ink',
  caution: 'bg-caution-wash text-caution-ink',
}

/** Compact status label. Use sparingly; the spec warns against overusing pills. */
export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase',
        toneClasses[tone],
        className,
      )}
    >
      {icon && <span aria-hidden className="inline-flex [&_svg]:size-3.5">{icon}</span>}
      {children}
    </span>
  )
}
