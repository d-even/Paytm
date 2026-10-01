import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { UNDO_WINDOWS } from '../../lib/trust'
import { SegmentedChoice } from '../ui'

type UndoWindow = (typeof UNDO_WINDOWS)[number]

/** 15 / 30 / 60 / 120 minutes, with a concrete "undo until" example. */
export function UndoWindowChoice({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const { t } = useTranslation()
  const helpId = useId()
  const exampleId = useId()
  const label = (m: number) => (m < 60 ? t('trust.undoMinutes', { count: m }) : t('trust.undoHours', { count: m / 60 }))
  const until = new Date(2000, 0, 1, 10, value)
  const time = `${until.getHours()}:${String(until.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold">{t('trust.undoTitle')}</h3>
        <p id={helpId} className="text-[15px] text-slate">
          {t('trust.undoHelp')}
        </p>
      </div>
      <SegmentedChoice<string>
        legend={t('trust.undoTitle')}
        hideLegend
        value={String(value)}
        onChange={(v) => onChange(Number(v) as UndoWindow)}
        describedBy={`${helpId} ${exampleId}`}
        options={UNDO_WINDOWS.map((m) => ({ value: String(m), label: label(m) }))}
      />
      <p id={exampleId} className="text-sm text-slate">
        {t('trust.undoExample', { time })}
      </p>
    </div>
  )
}
