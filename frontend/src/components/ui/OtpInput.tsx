import { forwardRef, useState } from 'react'
import { cn } from '../../lib/cn'

export type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  length?: number
  /** Accessible name, e.g. "6-digit OTP". */
  label: string
  invalid?: boolean
  describedBy?: string
  /** While checking: the field keeps focus (so the merchant can retype at once) but ignores input. */
  busy?: boolean
  autoFocus?: boolean
}

/**
 * One real input drawn as separate digit boxes. Keeping a single field means
 * paste, SMS autofill (autocomplete="one-time-code") and screen readers all
 * work without any per-box focus juggling.
 */
export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput(
  { value, onChange, length = 6, label, invalid, describedBy, busy, autoFocus },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, length - 1)

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        value={value}
        readOnly={busy}
        aria-busy={busy || undefined}
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        // No maxLength: a pasted "482 913" must keep all six digits before the spaces are dropped.
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Transparent text and caret: the boxes below are the visible field, and
        // the active box carries the focus ring.
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-100 shadow-none outline-none selection:bg-transparent"
      />
      <div aria-hidden className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i]
          const isActive = focused && i === active
          return (
            <span
              key={i}
              className={cn(
                'clay-inset flex h-14 items-center justify-center rounded-2xl text-2xl font-semibold text-ink tabular-nums transition-shadow sm:h-16',
                isActive && 'ring-3 ring-accent',
                invalid && !isActive && 'ring-2 ring-danger',
                busy && 'opacity-60',
              )}
            >
              {digit ?? (isActive ? <span className="h-7 w-0.5 animate-pulse rounded-full bg-accent-ink" /> : '')}
            </span>
          )
        })}
      </div>
    </div>
  )
})
