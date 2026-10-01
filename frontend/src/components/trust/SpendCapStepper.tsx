import { Minus, Plus } from 'lucide-react'
import { useId, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatINR } from '../../lib/format'
import { REGULARS_COUNT, SPEND_CAP } from '../../lib/trust'

/**
 * Spend cap as a spinbutton (WAI-ARIA APG): arrow keys, Page Up/Down, Home and
 * End on the number itself; the round − / + buttons serve touch and mouse.
 */
export function SpendCapStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation()
  const labelId = useId()
  const helpId = useId()
  const perRegularId = useId()
  const { min, max, step } = SPEND_CAP
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next / step) * step)))

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + step * 5,
      PageDown: value - step * 5,
      Home: min,
      End: max,
    }
    if (e.key in moves) {
      e.preventDefault()
      set(moves[e.key])
    }
  }

  const perRegular = Math.floor(value / REGULARS_COUNT)
  const round = 'flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink [box-shadow:var(--clay-shadow-soft)] transition-transform active:scale-95 disabled:opacity-40'

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 id={labelId} className="text-lg font-semibold">
          {t('trust.capTitle')}
        </h3>
        <p id={helpId} className="text-[15px] text-slate">
          {t('trust.capHelp')}
        </p>
      </div>
      <div className="clay-inset flex items-center justify-between gap-3 p-2">
        <button type="button" tabIndex={-1} className={round} onClick={() => set(value - step)} disabled={value <= min} aria-label={t('trust.capDecrease')}>
          <Minus className="size-5" strokeWidth={2.6} />
        </button>
        <div
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-describedby={`${helpId} ${perRegularId}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatINR(value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded-2xl py-1 text-center text-[40px] leading-tight font-bold tracking-[-0.02em] text-ink tabular-nums"
        >
          {formatINR(value)}
        </div>
        <button type="button" tabIndex={-1} className={round} onClick={() => set(value + step)} disabled={value >= max} aria-label={t('trust.capIncrease')}>
          <Plus className="size-5" strokeWidth={2.6} />
        </button>
      </div>
      <p id={perRegularId} className="text-sm text-slate">
        {t('trust.capPerRegular', { amount: formatINR(perRegular), count: REGULARS_COUNT })}
      </p>
    </div>
  )
}
