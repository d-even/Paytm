import { TrendingDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useActions, useCampaigns, useInsights } from '../../hooks/queries'
import { weekdayName } from '../../i18n/weekdays'
import { formatINR } from '../../lib/format'
import { ClayCard, Skeleton } from '../ui'
import { useWhy } from './useWhy'
import { WhyButton, WhyPanel } from './WhyPanel'

/**
 * The sales dip Mitra spotted (yesterday vs the same day last week), the
 * pattern behind it and what Mitra already did about it.
 */
export function DipInsightCard() {
  const { t } = useTranslation()
  const { data: insights, isError } = useInsights()
  const { data: actions } = useActions()
  const { data: campaigns } = useCampaigns()
  const why = useWhy()

  if (isError) return null
  if (!insights) return <Skeleton className="h-40 rounded-clay" />

  const { yesterday } = insights.briefing
  const dip = insights.insights.find((i) => i.kind === 'sales_dip')
  const action = dip?.actionId ? actions?.find((a) => a.id === dip.actionId) : undefined
  const campaign = action?.campaignId ? campaigns?.find((c) => c.id === action.campaignId) : undefined
  const day = weekdayName(t, yesterday.dayLabel)
  const live = action && (action.status === 'auto_done' || action.status === 'paused')

  return (
    <ClayCard as="section" aria-labelledby="dip-title" padding="none" className="flex flex-col gap-3 px-5 py-5 sm:px-6">
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-lg bg-caution-wash text-caution-ink">
          <TrendingDown className="size-4" />
        </span>
        <p className="text-sm font-semibold text-slate">{t('counter.dip.eyebrow')}</p>
      </div>
      <h2 id="dip-title" className="text-xl leading-snug font-bold">
        {t('counter.dip.headline', { sales: formatINR(yesterday.sales), pct: Math.abs(yesterday.comparison.changePct), day })}
      </h2>
      <p className="text-slate">
        {t('counter.dip.pattern', { day })}
        {live && campaign && (
          <>
            {' '}
            {t('counter.dip.action', { day, regulars: campaign.audience.count, cap: formatINR(action.costCap ?? 0) })}
          </>
        )}
      </p>
      {action && (
        <>
          <WhyButton {...why} className="-ml-3 self-start" />
          <WhyPanel why={action.why} open={why.open} panelId={why.panelId} />
        </>
      )}
    </ClayCard>
  )
}
