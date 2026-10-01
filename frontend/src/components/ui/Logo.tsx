import { cn } from '../../lib/cn'
import { FloatingOrb } from './FloatingOrb'

/** Wordmark: tiny AI orb + "Vyapaar Mitra". */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <FloatingOrb size="sm" pulse={false} />
      <span
        className={cn(
          'font-bold whitespace-nowrap tracking-[-0.02em] text-ink transition-[font-size] duration-300',
          compact ? 'text-[17px]' : 'text-lg',
        )}
      >
        Vyapaar <span className="text-accent-ink">Mitra</span>
      </span>
    </span>
  )
}
