import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { sectionFor, sectionNav } from '../../data/appNav'
import { useMerchant, usePendingCount } from '../../hooks/queries'
import { cn } from '../../lib/cn'
import { LanguageSelect } from '../language/LanguageSelect'
import { FloatingOrb } from '../ui/FloatingOrb'
import { LiveIndicator } from './LiveIndicator'
import { NavBadge } from './NavBadge'

/**
 * Top bar on every signed-in screen: "Vyapaar Mitra · <section>", the masked
 * merchant ID, a live indicator, the language switch and the settings gear.
 * From 768px the sections sit in a tab row underneath.
 */
export function AppHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const section = sectionFor(pathname)
  const { data: merchant } = useMerchant()
  const pendingCount = usePendingCount()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-10">
        <Link to="/" aria-label={t('shell.homeLink')} className="shrink-0 rounded-full p-1 max-[359px]:hidden">
          <FloatingOrb size="sm" pulse={false} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink sm:text-lg">
            <span lang="en">Vyapaar Mitra</span>
            {section && (
              <>
                <span aria-hidden className="px-1.5 font-medium text-slate-soft">
                  ·
                </span>
                <span className="text-accent-ink">{t(section.labelKey)}</span>
              </>
            )}
          </p>
          {merchant && <p className="truncate text-xs text-slate-soft md:hidden">{t('shell.merchantId', { id: merchant.id })}</p>}
        </div>
        {merchant && (
          <span className="hidden shrink-0 rounded-full bg-well px-3 py-1.5 text-sm font-medium text-slate md:inline-flex">
            {t('shell.merchantId', { id: merchant.id })}
          </span>
        )}
        <LiveIndicator />
        <LanguageSelect className="hidden lg:block" />
        <Link
          to="/settings"
          aria-label={t('nav.settings')}
          aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          className={cn(
            'clay-button inline-flex size-12 shrink-0 items-center justify-center text-ink [box-shadow:var(--clay-shadow-soft)]',
            pathname.startsWith('/settings') ? 'bg-accent-wash' : 'bg-surface',
          )}
        >
          <Settings aria-hidden className="size-5" />
        </Link>
      </div>

      <nav aria-label={t('shell.sections')} className="hidden md:block">
        <ul className="mx-auto flex w-full max-w-[1200px] gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:px-8">
          {sectionNav.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to} className="shrink-0">
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-12 items-center gap-2 rounded-t-xl px-3 text-[15px] font-medium whitespace-nowrap transition-colors',
                      'after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:transition-colors',
                      isActive ? 'text-ink after:bg-accent' : 'text-slate after:bg-transparent hover:bg-well hover:text-ink',
                    )
                  }
                >
                  <Icon aria-hidden className="size-[18px]" />
                  {t(item.labelKey)}
                  {item.badge === 'pending' && <NavBadge count={pendingCount} />}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
