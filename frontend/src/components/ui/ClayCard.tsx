import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'white' | 'cloud' | 'wash' | 'blue'
type Elevation = 'soft' | 'raised' | 'inset'
type Padding = 'none' | 'sm' | 'md' | 'lg'

export type ClayCardProps = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLDivElement>
  as?: ElementType
  tone?: Tone
  elevation?: Elevation
  padding?: Padding
  /** Lifts gently on hover; use for cards that respond to interaction. */
  interactive?: boolean
  children: ReactNode
}

const toneClasses: Record<Tone, string> = {
  white: 'bg-surface',
  cloud: 'bg-well',
  wash: 'bg-accent-wash',
  blue: 'bg-accent text-on-accent',
}

const elevationClasses: Record<Elevation, string> = {
  raised: 'rounded-clay-lg [box-shadow:var(--clay-shadow-raised)]',
  soft: 'rounded-clay [box-shadow:var(--clay-shadow-soft)]',
  inset: 'rounded-clay [box-shadow:var(--clay-shadow-inset)]',
}

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-7 sm:p-9',
}

/** The base clay surface every card in the product is built on. */
export function ClayCard({
  as: Component = 'div',
  tone = 'white',
  elevation = 'raised',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...rest
}: ClayCardProps) {
  return (
    <Component
      className={cn(
        'relative',
        toneClasses[tone],
        elevationClasses[elevation],
        tone === 'blue' && elevation !== 'inset' && '[box-shadow:var(--clay-shadow-accent)]',
        paddingClasses[padding],
        interactive && 'clay-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
}
