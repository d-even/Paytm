import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'
import { ErrorState, MetricCard, Skeleton } from '../components/ui'
import { useCampaigns } from '../hooks/queries'

export function Campaigns() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useCampaigns()
  const campaign = data?.[0]

  return (
    <>
      <PageHeader title={t('pages.campaigns.title')} subtitle={t('pages.campaigns.subtitle')} />
      <ComingNext phase={5} items={[t('pages.campaigns.next1'), t('pages.campaigns.next2'), t('pages.campaigns.next3')]}>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <Skeleton className="h-36 rounded-clay" />
        ) : (
          campaign && (
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label={campaign.name}
                value={campaign.audience.count}
                delta={{ label: t('pages.campaigns.audience', { count: campaign.audience.count }), direction: 'neutral' }}
              />
              <MetricCard label={t('pages.campaigns.delivered')} value={campaign.funnel.delivered} />
              <MetricCard label={t('pages.campaigns.redeemed')} value={campaign.funnel.redeemed} />
            </div>
          )
        )}
      </ComingNext>
    </>
  )
}
