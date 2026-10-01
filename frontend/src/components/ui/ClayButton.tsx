import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

type CommonProps = {
  variant?: Variant
  size?: Size
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
  className?: string
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined; ref?: Ref<HTMLButtonElement> }
type AsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string; ref?: Ref<HTMLAnchorElement> }

export type ClayButtonProps = AsButton | AsLink

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent [box-shadow:var(--clay-shadow-accent)] hover:bg-accent-hover',
  accent:
    'bg-coral-wash text-coral-ink [box-shadow:var(--clay-shadow-soft)] hover:bg-[#fde0e6]',
  secondary:
    'bg-surface text-ink [box-shadow:var(--clay-shadow-soft)] hover:[box-shadow:var(--clay-shadow-raised)]',
  ghost: 'bg-transparent text-ink hover:bg-surface-2',
}

// Every size keeps the 48px minimum tap target; sm is narrower and quieter, not shorter.
const sizeClasses: Record<Size, string> = {
  sm: 'h-12 px-4 text-sm gap-1.5',
  md: 'h-12 px-6 text-[15px] gap-2',
  lg: 'h-14 px-7 text-base gap-2.5',
}

/**
 * Tactile clay button. Renders a real <button>, or an <a> when given `href`,
 * so semantics always match behaviour.
 */
export function ClayButton(props: ClayButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    fullWidth,
    children,
    className,
    ...rest
  } = props

  const classes = cn(
    'clay-button inline-flex select-none items-center justify-center font-semibold whitespace-nowrap',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-70',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className,
  )

  const content = (
    <>
      {leadingIcon && <span className="-ml-0.5 inline-flex shrink-0" aria-hidden>{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="-mr-0.5 inline-flex shrink-0" aria-hidden>{trailingIcon}</span>}
    </>
  )

  if (rest.href !== undefined) {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    )
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type={type} className={classes} {...buttonRest}>
      {content}
    </button>
  )
}
