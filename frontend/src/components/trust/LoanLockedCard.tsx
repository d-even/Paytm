import { Landmark, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ClayCard, IconBubble } from '../ui'
import { StakesLabel } from './StakesLabel'

/**
 * Loans are always recommend-only. There is no control to tap and be refused:
 * just the rule, the reason, and a lock.
 */
export function LoanLockedCard() {
  const { t } = useTranslation()
  return (
    <ClayCard padding="md" elevation="soft" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <IconBubble size="md" tone="cloud">
          <Landmark />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg leading-snug font-semibold">{t('trust.loanTitle')}</h3>
            <StakesLabel risk="high">{t('trust.loanStakes')}</StakesLabel>
          </div>
          <p className="mt-0.5 text-[15px] text-slate">{t('trust.loanExample')}</p>
        </div>
      </div>
      <div className="flex min-h-12 items-center gap-3 rounded-[20px] bg-accent-wash px-4 py-3 text-ink [box-shadow:var(--clay-rim)]">
        <Lock aria-hidden className="size-5 shrink-0 text-accent-ink" strokeWidth={2.4} />
        <p className="font-semibold">
          {t('trust.loanLocked')} <span aria-hidden>·</span> {t('trust.loanYouDecide')}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] text-slate">{t('trust.loanReason')}</p>
        <p className="text-sm font-medium text-slate-soft">{t('trust.loanFixed')}</p>
      </div>
    </ClayCard>
  )
}
