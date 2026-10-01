import type { TFunction } from 'i18next'
import type { en } from './locales/en'

type Weekday = keyof typeof en.weekdays

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * The API names days in English ("Tuesday"). This returns the day in the
 * merchant's language, or the label unchanged if it isn't a weekday.
 */
export function weekdayName(t: TFunction, label: string): string {
  const day = WEEKDAYS.find((d) => d === label.trim().toLowerCase())
  return day ? t(`weekdays.${day}`) : label
}
