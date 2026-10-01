import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'
import { ErrorState, MetricCard, Skeleton } from '../components/ui'
import { useOutcomes } from '../hooks/queries'
import { formatINR } from '../lib/format'

export function Impact() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useOutcomes()
  return (
    <>
      <PageHeader title={t('pages.impact.title')} subtitle={t('pages.impact.subtitle')} />
      <ComingNext phase={7} items={[t('pages.impact.next1'), t('pages.impact.next2')]}>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <Skeleton className="h-36 rounded-clay" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label={t('pages.impact.tuesdayBeforeAfter')}
              value={`${formatINR(data.headline.before.sales)} → ${formatINR(data.headline.after.sales)}`}
              delta={{ label: t('pages.impact.pilot', { pct: data.headline.changePct }), direction: 'up' }}
            />
          </div>
        )}
      </ComingNext>
    </>
  )
}
