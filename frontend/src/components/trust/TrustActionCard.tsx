import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Hand, ShieldCheck, TriangleAlert, Zap } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { formatINR } from '../../lib/format'
import { REGULARS_COUNT, TRUST_MODES, type ControllableAction, type ControllableMode } from '../../lib/trust'
import type { TrustSettings } from '../../mocks/types'
import { ClayCard, IconBubble, SegmentedChoice } from '../ui'
import { ACTION_COPY, MODE_LABEL, MODE_WHAT } from './copy'
import { StakesLabel } from './StakesLabel'

const MODE_ICON: Record<ControllableMode, typeof Zap> = { auto: Zap, ask: Hand, off: Ban }

/** One action type: what it looks like in this shop, and Auto / Ask me first / Off. */
export function TrustActionCard({
  action,
  settings,
  onChange,
}: {
  action: ControllableAction
  settings: TrustSettings
  onChange: (mode: ControllableMode) => void
}) {
  const { t } = useTranslation()
  const whatId = useId()
  const netId = useId()
  const copy = ACTION_COPY[action]
  const mode = settings.modes[action]
  const title = t(copy.title)

  return (
    <ClayCard padding="md" elevation="soft" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <IconBubble size="md">
          <copy.icon />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg leading-snug font-semibold">{title}</h3>
            <StakesLabel risk={copy.risk}>{t(copy.stakes)}</StakesLabel>
          </div>
          <p className="mt-0.5 text-[15px] text-slate">{t(copy.example, { count: REGULARS_COUNT })}</p>
        </div>
      </div>

      <SegmentedChoice
        legend={t('trust.modesLegend', { action: title })}
        hideLegend
        value={mode}
        onChange={onChange}
        describedBy={mode === 'auto' ? `${whatId} ${netId}` : whatId}
        options={TRUST_MODES.map((m) => {
          const Icon = MODE_ICON[m]
          return { value: m, label: t(MODE_LABEL[m]), icon: <Icon /> }
        })}
      />

      <div className="flex flex-col gap-2">
        {/* Only this line is live: it says what the choice just made means. */}
        <p id={whatId} aria-live="polite" className="text-[15px] font-medium text-ink">
          {t(MODE_WHAT[mode])}
        </p>
        <AnimatePresence initial={false}>
          {mode === 'auto' && (
            <motion.p
              key="net"
              id={netId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                'flex items-start gap-2 overflow-hidden rounded-2xl px-3 py-2 text-sm font-medium',
                action === 'reorder' ? 'bg-caution-wash text-caution-ink' : 'bg-success-wash text-success-ink',
              )}
            >
              {action === 'reorder' ? (
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              {/* The spend cap only limits offers, so only Marketing shows it. */}
              {action === 'marketing'
                ? t('trust.safetyNet', { cap: formatINR(settings.campaignSpendCap), minutes: settings.undoWindowMinutes })
                : action === 'pricing'
                  ? t('trust.safetyNetUndo', { minutes: settings.undoWindowMinutes })
                  : t('trust.reorderAutoWarning', { minutes: settings.undoWindowMinutes })}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </ClayCard>
  )
}
