import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'
import { ErrorState, MetricCard, Skeleton } from '../components/ui'
import { useCashflow } from '../hooks/queries'
import { formatINR } from '../lib/format'

export function Credit() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useCashflow()
  const shortfall = data ? data.days[data.shortfallDayIndex] : undefined

  return (
    <>
      <PageHeader title={t('pages.credit.title')} subtitle={t('pages.credit.subtitle')} />
      <ComingNext phase={6} items={[t('pages.credit.next1'), t('pages.credit.next2'), t('pages.credit.next3')]}>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <Skeleton className="h-36 rounded-clay" />
        ) : (
          shortfall && (
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                label={t('pages.credit.shortIn')}
                value={t('pages.credit.days', { count: data.shortfallDayIndex })}
                delta={{ label: t('pages.credit.supplierDue'), direction: 'down' }}
              />
              <MetricCard label={t('pages.credit.lowestBalance')} value={formatINR(shortfall.balance)} />
            </div>
          )
        )}
      </ComingNext>
    </>
  )
}
