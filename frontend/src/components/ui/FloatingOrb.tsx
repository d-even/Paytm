import { cn } from '../../lib/cn'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizePx: Record<Size, number> = { xs: 14, sm: 22, md: 44, lg: 88, xl: 160 }

export type FloatingOrbProps = {
  size?: Size
  /** Soft ring that breathes outward; the orb's "AI is listening" signal. */
  pulse?: boolean
  float?: boolean
  className?: string
  label?: string
}

/**
 * The Vyapaar Mitra AI orb: a glossy cyan-to-blue clay sphere.
 * Decorative by default; pass `label` when it carries meaning.
 */
export function FloatingOrb({ size = 'md', pulse = true, float = false, className, label }: FloatingOrbProps) {
  const px = sizePx[size]
  return (
    <span
      className={cn('relative inline-flex shrink-0', float && 'animate-float', className)}
      style={{ width: px, height: px }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {pulse && (
        <span className="absolute inset-0 animate-orb-pulse rounded-full bg-accent/60" />
      )}
      <span
        className="relative block h-full w-full rounded-full"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, #ffffff 0%, #9be8ff 14%, #00baf2 46%, #0a6fb8 78%, #0a1f44 100%)',
          boxShadow:
            px > 30
              ? `0 ${px * 0.14}px ${px * 0.32}px rgb(0 94 170 / 0.35), inset -${px * 0.06}px -${px * 0.08}px ${px * 0.14}px rgb(0 30 90 / 0.35)`
              : '0 2px 6px rgb(0 94 170 / 0.35)',
        }}
      />
    </span>
  )
}
