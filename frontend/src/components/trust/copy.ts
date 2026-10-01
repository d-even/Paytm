import { Megaphone, Package, Tag, type LucideIcon } from 'lucide-react'
import type { ControllableAction, ControllableMode } from '../../lib/trust'
import type { RiskLevel } from '../../mocks/types'

/** Translation keys and visuals for each action type. Stakes use the risk colours. */
export const ACTION_COPY: Record<
  ControllableAction,
  {
    title: `trust.${ControllableAction}Title`
    example: `trust.${ControllableAction}Example`
    stakes: `trust.${ControllableAction}Stakes`
    risk: RiskLevel
    icon: LucideIcon
  }
> = {
  marketing: { title: 'trust.marketingTitle', example: 'trust.marketingExample', stakes: 'trust.marketingStakes', risk: 'low', icon: Megaphone },
  pricing: { title: 'trust.pricingTitle', example: 'trust.pricingExample', stakes: 'trust.pricingStakes', risk: 'low', icon: Tag },
  reorder: { title: 'trust.reorderTitle', example: 'trust.reorderExample', stakes: 'trust.reorderStakes', risk: 'medium', icon: Package },
}

export const MODE_LABEL: Record<ControllableMode, 'trust.modeAuto' | 'trust.modeAsk' | 'trust.modeOff'> = {
  auto: 'trust.modeAuto',
  ask: 'trust.modeAsk',
  off: 'trust.modeOff',
}

export const MODE_WHAT: Record<ControllableMode, 'trust.whatAuto' | 'trust.whatAsk' | 'trust.whatOff'> = {
  auto: 'trust.whatAuto',
  ask: 'trust.whatAsk',
  off: 'trust.whatOff',
}

export const MODE_SUMMARY: Record<ControllableMode, 'trust.summaryAuto' | 'trust.summaryAsk' | 'trust.summaryOff'> = {
  auto: 'trust.summaryAuto',
  ask: 'trust.summaryAsk',
  off: 'trust.summaryOff',
}

export const RISK_DOT: Record<RiskLevel, string> = {
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
}
