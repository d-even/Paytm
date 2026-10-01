import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useLiveFeed } from '../../hooks/useLiveFeed'
import { SoundboxVoice } from '../counter/SoundboxVoice'
import { AppHeader } from './AppHeader'
import { BottomTabs } from './BottomTabs'
import { MoreSheet } from './MoreSheet'

/**
 * Signed-in layout. One component tree for every screen size: a header with
 * section tabs from 768px up, and a bottom tab bar below it. Pages render
 * into a centred ~1200px column.
 */
export function AppShell() {
  const { t } = useTranslation()
  useLiveFeed()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only z-[60] rounded-full bg-accent px-5 py-3 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {t('shell.skipToContent')}
      </a>
      <AppHeader />
      <main id="main" tabIndex={-1} className="flex-1 pb-28 outline-none md:pb-12">
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 sm:px-6 md:pt-8 lg:px-10">
          <Outlet />
        </div>
      </main>
      <BottomTabs />
      <MoreSheet />
      <SoundboxVoice />
    </div>
  )
}
