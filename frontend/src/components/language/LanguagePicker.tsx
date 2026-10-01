import { Check, Square, Volume2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../i18n/languages'
import { cn } from '../../lib/cn'
import { useSpeech } from '../../lib/speech'
import type { LanguageCode } from '../../mocks/types'

/**
 * Four large language cards. Each name and sample line is written in its own
 * script, and can be heard before choosing. Picking one switches the whole UI
 * straight away, so the merchant sees the result of the choice immediately.
 */
export function LanguagePicker({
  value,
  onChange,
  legend,
  hideLegend = true,
}: {
  value: LanguageCode
  onChange: (code: LanguageCode) => void
  legend: string
  hideLegend?: boolean
}) {
  const { t } = useTranslation()
  const name = useId()
  const { supported, speakingId, speak, stop } = useSpeech()

  return (
    <fieldset className="min-w-0">
      <legend className={cn(hideLegend ? 'sr-only' : 'mb-3 text-lg font-semibold text-ink')}>{legend}</legend>
      <div className="@container">
        <div className="grid gap-3 @lg:grid-cols-2">
          {LANGUAGES.map((language) => {
            const checked = language.code === value
            const speaking = speakingId === language.code
            return (
              <div key={language.code} className="relative">
                <label
                  className={cn(
                    'flex min-h-[120px] cursor-pointer flex-col gap-1 rounded-clay bg-surface p-4 pr-16 transition-all duration-200',
                    'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent',
                    checked
                      ? 'ring-3 ring-accent [box-shadow:var(--clay-shadow-raised)]'
                      : '[box-shadow:var(--clay-shadow-soft)] hover:[box-shadow:var(--clay-shadow-raised)]',
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={language.code}
                    checked={checked}
                    onChange={() => onChange(language.code)}
                    className="sr-only"
                  />
                  <span lang={language.htmlLang} className="text-xl leading-tight font-semibold text-ink">
                    {language.nativeName}
                  </span>
                  {language.englishName !== language.nativeName && (
                    <span lang="en" className="text-sm text-slate-soft">
                      {language.englishName}
                    </span>
                  )}
                  <span lang={language.htmlLang} className="mt-1 text-[15px] text-slate">
                    {language.sample}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-4 right-4 flex size-7 items-center justify-center rounded-full transition-all',
                      checked ? 'bg-accent text-on-accent' : 'bg-well text-transparent ring-1 ring-line-strong ring-inset',
                    )}
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                </label>
                {supported && (
                  <button
                    type="button"
                    onClick={() => (speaking ? stop() : speak(language.speechSample ?? language.sample, language.code, language.code))}
                    aria-label={speaking ? t('onboarding.stopListening') : t('onboarding.listenTo', { language: language.nativeName })}
                    className="absolute right-2 bottom-2 flex size-12 items-center justify-center rounded-full text-accent-ink transition-colors hover:bg-accent-wash"
                  >
                    {speaking ? <Square className="size-4 fill-current" /> : <Volume2 className="size-5" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}
