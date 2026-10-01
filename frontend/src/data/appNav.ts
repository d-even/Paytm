import {
  ListChecks,
  Megaphone,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { en } from '../i18n/locales/en'

type NavKey = `nav.${Exclude<keyof typeof en.nav, 'main' | 'more'>}`

export type AppNavItem = {
  to: string
  labelKey: NavKey
  /** Shorter label for the mobile tab bar. */
  shortLabelKey?: NavKey
  icon: LucideIcon
  /** Shows the pending-approval count. */
  badge?: 'pending'
}

const counter: AppNavItem = { to: '/', labelKey: 'nav.counter', icon: Store }
const actions: AppNavItem = { to: '/actions', labelKey: 'nav.actions', icon: ListChecks, badge: 'pending' }
const campaigns: AppNavItem = { to: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone }
const regulars: AppNavItem = { to: '/regulars', labelKey: 'nav.regulars', icon: Users }
const credit: AppNavItem = { to: '/credit', labelKey: 'nav.credit', shortLabelKey: 'nav.creditShort', icon: Wallet }
const impact: AppNavItem = { to: '/impact', labelKey: 'nav.impact', icon: TrendingUp }
const ask: AppNavItem = { to: '/ask', labelKey: 'nav.ask', shortLabelKey: 'nav.askShort', icon: Sparkles }
const settings: AppNavItem = { to: '/settings', labelKey: 'nav.settings', icon: Settings }

/** Section tabs under the header (768px and up). Settings sits behind the gear. */
export const sectionNav: AppNavItem[] = [counter, actions, campaigns, regulars, credit, impact, ask]

/** Mobile bottom tabs; the fifth slot opens "More". */
export const mobileTabs: AppNavItem[] = [counter, actions, campaigns, credit]

/** Mobile "More" sheet. */
export const moreNav: AppNavItem[] = [ask, regulars, impact, settings]

/** The section a path belongs to, for the header title. */
export function sectionFor(pathname: string): AppNavItem | undefined {
  return [...sectionNav, settings].find((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))
}
