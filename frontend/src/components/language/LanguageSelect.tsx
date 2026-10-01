import { ChevronDown, Languages } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../i18n/languages'
import { cn } from '../../lib/cn'
import { useSession } from '../../store/session'
import type { LanguageCode } from '../../mocks/types'

/**
 * Compact language switch for screens without the full picker (sign-in).
 * A native select, so phones show their own accessible picker.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { t } = useTranslation()
  const id = useId()
  const language = useSession((s) => s.language)
  const setLanguage = useSession((s) => s.setLanguage)

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {t('auth.languageLabel')}
      </label>
      <Languages aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-accent-ink" />
      <select
        id={id}
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="h-12 cursor-pointer appearance-none rounded-full bg-surface pr-10 pl-10 text-[15px] font-semibold text-ink [box-shadow:var(--clay-shadow-soft)]"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.htmlLang}>
            {l.nativeName}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-slate" />
    </div>
  )
}
