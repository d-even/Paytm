import { LayoutGrid } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { mobileTabs, moreNav } from '../../data/appNav'
import { usePendingCount } from '../../hooks/queries'
import { cn } from '../../lib/cn'
import { useUi } from '../../store/ui'
import { NavBadge } from './NavBadge'

const cell = 'relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors'

function TabIcon({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
        active && 'bg-accent-wash text-accent-ink',
      )}
    >
      {children}
    </span>
  )
}

/** Mobile bottom tab bar (<768px): four sections plus "More". */
export function BottomTabs() {
  const { t } = useTranslation()
  const pendingCount = usePendingCount()
  const { pathname } = useLocation()
  const moreOpen = useUi((s) => s.moreOpen)
  const setMoreOpen = useUi((s) => s.setMoreOpen)
  const inMore = moreNav.some((item) => pathname.startsWith(item.to))

  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] [box-shadow:0_-8px_24px_rgb(10_31_68/0.06)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {mobileTabs.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn(cell, isActive ? 'text-ink' : 'text-slate-soft hover:text-ink')}
              >
                {({ isActive }) => (
                  <>
                    <TabIcon active={isActive}>
                      <Icon aria-hidden className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                      {item.badge === 'pending' && (
                        <NavBadge count={pendingCount} className="absolute -top-1 -right-1 h-[18px] min-w-[18px] text-[10px]" />
                      )}
                    </TabIcon>
                    <span className={cn('line-clamp-2 text-center leading-tight', isActive && 'font-semibold')}>
                      {t(item.shortLabelKey ?? item.labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(cell, inMore ? 'text-ink' : 'text-slate-soft hover:text-ink')}
          >
            <TabIcon active={inMore}>
              <LayoutGrid aria-hidden className="size-[22px]" strokeWidth={inMore ? 2.4 : 2} />
            </TabIcon>
            <span className={cn('line-clamp-2 text-center leading-tight', inMore && 'font-semibold')}>{t('nav.more')}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
