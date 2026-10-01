import { cn } from '../../lib/cn'
import { useTranslation } from 'react-i18next'

/** Small count bubble for nav items, e.g. actions awaiting approval. */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation()
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] leading-none font-bold text-on-accent',
        className,
      )}
    >
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t('shell.pending', { count })}</span>
    </span>
  )
}
