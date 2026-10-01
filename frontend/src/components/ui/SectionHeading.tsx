import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-eyebrow uppercase text-accent-ink', className)}>{children}</p>
  )
}

/** Eyebrow + heading + supporting line, used at the top of every section. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  as: Heading = 'h2',
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex max-w-3xl flex-col gap-4',
        align === 'center' ? 'mx-auto items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading className="text-section">{title}</Heading>
      {description && <p className="max-w-2xl text-body-lg text-slate">{description}</p>}
    </div>
  )
}
