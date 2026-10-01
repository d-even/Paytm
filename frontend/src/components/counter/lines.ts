import type { TFunction } from 'i18next'
import { weekdayName } from '../../i18n/weekdays'
import { formatINR } from '../../lib/format'
import type { Line } from '../../store/counter'

const money = (value?: number) => (value === undefined ? undefined : formatINR(value))

/**
 * Turns a stored Soundbox or activity line into text in the current language.
 * Pass a different `t` (e.g. Hindi) to get the text the voice should read.
 */
export function lineText(t: TFunction, line: Line): string {
  const p = line.params ?? {}
  return t(line.key, {
    ...p,
    amount: money(p.amount),
    cost: money(p.cost),
    cap: money(p.cap),
    today: money(p.today),
    yesterday: money(p.yesterday),
    day: p.day ? weekdayName(t, p.day) : undefined,
    what: p.type ? t(`counter.what.${p.type}`) : undefined,
  } as Record<string, unknown>) as string
}

/** Clock time in the merchant's language, e.g. "10:42 am". */
export function clockTime(at: number | string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(at))
}
