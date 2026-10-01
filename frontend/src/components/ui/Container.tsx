import type { ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Page-width wrapper with the standard side gutters. */
export function Container({
  as: Component = 'div',
  className,
  children,
}: {
  as?: ElementType
  className?: string
  children: ReactNode
}) {
  return <Component className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</Component>
}
