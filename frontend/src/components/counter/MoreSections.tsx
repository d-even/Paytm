import { ChevronRight, Languages, Megaphone, ShieldCheck, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { LanguageSelect } from '../language/LanguageSelect'

type Tile = { to: string; icon: LucideIcon; title: string; body: string }

/** Every other part of the app, one tap from the counter (the tabs and gear above lead to the same places). */
export function MoreSections({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  const { t } = useTranslation()
  const tiles: Tile[] = [
    { to: '/campaigns', icon: Megaphone, title: t('nav.campaigns'), body: t('counter.sections.campaigns') },
    { to: '/regulars', icon: Users, title: t('nav.regulars'), body: t('counter.sections.regulars') },
    { to: '/credit', icon: Wallet, title: t('nav.credit'), body: t('counter.sections.credit') },
    { to: '/impact', icon: TrendingUp, title: t('nav.impact'), body: t('counter.sections.impact') },
    { to: '/settings', icon: ShieldCheck, title: t('counter.sections.trust'), body: t('counter.sections.trustBody') },
  ]

  return (
    <section aria-labelledby={`more-title${stacked ? '-side' : ''}`} className={className}>
      <h2 id={`more-title${stacked ? '-side' : ''}`} className="mb-4 text-lg font-bold">
        {t('counter.sections.title')}
      </h2>
      <ul className={cn('grid gap-3', !stacked && 'sm:grid-cols-2')}>
        {tiles.map(({ to, icon: Icon, title, body }) => (
          <li key={to + title}>
            <Link
              to={to}
              className="clay-soft clay-lift flex h-full min-h-20 items-center gap-3 rounded-[22px] px-4 py-3"
            >
              <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{title}</span>
                <span className="block text-sm text-slate">{body}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-slate-soft" />
            </Link>
          </li>
        ))}
        <li className="clay-soft flex min-h-20 flex-wrap items-center gap-3 rounded-[22px] px-4 py-3">
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
            <Languages className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{t('counter.sections.language')}</span>
            <span className="block text-sm text-slate">{t('counter.sections.languageBody')}</span>
          </span>
          <LanguageSelect />
        </li>
      </ul>
    </section>
  )
}
