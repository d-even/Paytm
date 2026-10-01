import { Lock, Megaphone, Sunrise } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelect } from '../language/LanguageSelect'
import { MitraHero } from '../illustrations'
import { FloatingOrb, Logo } from '../ui'

/**
 * Sign-in frame: Mitra greets the merchant beside the form on wide screens,
 * and above it (smaller, speech bubble to the side) on phones.
 */
export function AuthLayout({ bubble, children }: { bubble: string; children: ReactNode }) {
  const { t } = useTranslation()
  const promises = [
    { icon: Sunrise, text: t('auth.promise1') },
    { icon: Megaphone, text: t('auth.promise2') },
    { icon: Lock, text: t('auth.promise3') },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-well">
      <header className="mx-auto flex w-full max-w-[1160px] items-center justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6">
        <Logo />
        <LanguageSelect />
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-[1160px] flex-1 grid-cols-1 content-center gap-3 px-4 pt-2 pb-6 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:items-center md:gap-10 md:px-8 lg:gap-16"
      >
        <section className="relative flex items-end gap-2 md:flex-col md:items-center md:gap-6">
          {/* Soft stage behind Mitra (wide screens) */}
          <div aria-hidden className="pointer-events-none absolute inset-x-[6%] top-[4%] bottom-[22%] hidden rounded-full bg-[radial-gradient(closest-side,rgb(0_186_242/0.14),rgb(0_186_242/0))] md:block" />
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
            <span className="absolute top-[8%] left-[6%]">
              <FloatingOrb size="md" float className="opacity-80" />
            </span>
            <span className="absolute top-[40%] right-[4%]">
              <FloatingOrb size="sm" float pulse={false} className="[animation-delay:-3s]" />
            </span>
          </div>

          {/* Phones: small Mitra with the bubble beside him. Wider: bubble above, pointing down at him. */}
          <div className="relative flex w-full items-end gap-1 md:max-w-[440px] md:flex-col-reverse md:items-center md:gap-2">
            <MitraHero className="h-[168px] shrink-0 sm:h-[200px] md:h-[min(46vh,420px)]" />
            <p
              className="relative mb-auto ml-1 min-w-0 rounded-3xl rounded-bl-md bg-surface px-4 py-3 text-[15px] leading-snug font-semibold text-ink [box-shadow:var(--clay-shadow-soft)] md:mb-0 md:ml-0 md:max-w-[260px] md:self-end md:text-base"
              aria-live="polite"
            >
              {bubble}
            </p>
          </div>

          <ul className="hidden w-full max-w-[460px] flex-col gap-2.5 lg:flex">
            {promises.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-2.5 text-[15px] font-medium text-ink [box-shadow:var(--clay-shadow-soft)]">
                <Icon aria-hidden className="size-5 shrink-0 text-accent-ink" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div className="w-full">{children}</div>
      </main>

      <footer className="px-4 pb-5 text-center text-xs text-slate-soft">{t('auth.footer')}</footer>
    </div>
  )
}
