import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'cyan' | 'blue' | 'cloud' | 'success' | 'caution'
type Size = 'sm' | 'md' | 'lg'

const toneClasses: Record<Tone, string> = {
  cyan: 'bg-accent-wash text-accent-ink',
  blue: 'bg-accent text-on-accent',
  cloud: 'bg-well text-ink',
  success: 'bg-success-wash text-success-ink',
  caution: 'bg-caution-wash text-caution-ink',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 w-9 rounded-xl [&_svg]:size-[18px]',
  md: 'h-12 w-12 rounded-2xl [&_svg]:size-[22px]',
  lg: 'h-16 w-16 rounded-[22px] [&_svg]:size-7',
}

/** A small clay tile that holds an icon. Icons are always decorative here. */
export function IconBubble({
  children,
  tone = 'cyan',
  size = 'md',
  className,
}: {
  children: ReactNode
  tone?: Tone
  size?: Size
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center [box-shadow:inset_3px_3px_6px_rgb(255_255_255/0.7),inset_-3px_-3px_7px_rgb(10_31_68/0.07),3px_4px_10px_rgb(10_31_68/0.07)]',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
