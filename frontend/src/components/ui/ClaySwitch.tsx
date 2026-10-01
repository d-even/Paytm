import { useId } from 'react'
import { cn } from '../../lib/cn'

export type ClaySwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

/** Accessible on/off switch with a soft clay track and knob. */
export function ClaySwitch({ checked, onChange, label, description, disabled, className }: ClaySwitchProps) {
  const id = useId()
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block font-semibold text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-slate">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-9 w-16 shrink-0 items-center rounded-full p-1 transition-colors duration-300',
          '[box-shadow:inset_3px_3px_7px_rgb(10_31_68/0.16),inset_-3px_-3px_7px_rgb(255_255_255/0.6)]',
          checked ? 'bg-accent' : 'bg-well ring-1 ring-line-strong ring-inset',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'block h-7 w-7 rounded-full bg-surface transition-transform duration-300 ease-(--ease-clay)',
            '[box-shadow:2px_3px_6px_rgb(10_31_68/0.22),inset_-2px_-2px_4px_rgb(10_31_68/0.08),inset_2px_2px_4px_rgb(255_255_255/0.9)]',
            checked ? 'translate-x-7' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}
