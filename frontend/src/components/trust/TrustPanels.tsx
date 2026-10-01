import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTROLLABLE_ACTIONS, RECOMMENDED_TRUST, resetTrust, sameLimits, sameModes, type TrustScope } from '../../lib/trust'
import type { TrustSettings } from '../../mocks/types'
import { ClayButton, ClayCard } from '../ui'
import { LoanLockedCard } from './LoanLockedCard'
import { SpendCapStepper } from './SpendCapStepper'
import { TrustActionCard } from './TrustActionCard'
import { UndoWindowChoice } from './UndoWindowChoice'

type PanelProps = {
  value: TrustSettings
  onChange: (next: TrustSettings) => void
  /** Two columns once the panel itself is wide enough (Settings); onboarding keeps one. */
  columns?: 1 | 2
}

function PanelGrid({ columns = 1, children }: { columns?: 1 | 2; children: ReactNode }) {
  if (columns === 1) return <div className="flex flex-col gap-4">{children}</div>
  // Sized by the panel's own width, not the viewport, since the sidebar eats into it.
  return (
    <div className="@container">
      <div className="grid gap-4 @3xl:grid-cols-2">{children}</div>
    </div>
  )
}

/**
 * Trust Settings, split in two so onboarding can ask one thing per screen.
 * Both are purely controlled: saving is up to the screen that uses them.
 */
export function TrustModesPanel({ value, onChange, columns = 1 }: PanelProps) {
  return (
    <PanelGrid columns={columns}>
      {CONTROLLABLE_ACTIONS.map((action) => (
        <TrustActionCard
          key={action}
          action={action}
          settings={value}
          onChange={(mode) => onChange({ ...value, modes: { ...value.modes, [action]: mode } })}
        />
      ))}
      <LoanLockedCard />
    </PanelGrid>
  )
}

export function SafetyLimitsPanel({ value, onChange, columns = 1 }: PanelProps) {
  return (
    <PanelGrid columns={columns}>
      <ClayCard padding="md" elevation="soft">
        <SpendCapStepper value={value.campaignSpendCap} onChange={(campaignSpendCap) => onChange({ ...value, campaignSpendCap })} />
      </ClayCard>
      <ClayCard padding="md" elevation="soft">
        <UndoWindowChoice value={value.undoWindowMinutes} onChange={(undoWindowMinutes) => onChange({ ...value, undoWindowMinutes })} />
      </ClayCard>
    </PanelGrid>
  )
}

/**
 * Puts one part (the modes, or the limits) back to Mitra's suggestion, and
 * leaves the other alone. Shown only once that part differs.
 */
export function ResetTrustButton({ value, scope, onChange }: { value: TrustSettings; scope: TrustScope; onChange: (next: TrustSettings) => void }) {
  const { t } = useTranslation()
  if ((scope === 'modes' ? sameModes : sameLimits)(value, RECOMMENDED_TRUST)) return null
  return (
    <ClayButton variant="ghost" size="sm" onClick={() => onChange(resetTrust(value, scope))} leadingIcon={<RotateCcw className="size-4" />} className="self-start">
      {t('trust.reset')}
    </ClayButton>
  )
}
