import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'
import { ErrorState, MetricCard, Skeleton } from '../components/ui'
import { useRegulars } from '../hooks/queries'

export function Regulars() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useRegulars()
  return (
    <>
      <PageHeader title={t('pages.regulars.title')} subtitle={t('pages.regulars.subtitle')} />
      <ComingNext phase={5} items={[t('pages.regulars.next1'), t('pages.regulars.next2'), t('pages.regulars.next3')]}>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <Skeleton className="h-36 rounded-clay" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label={t('pages.regulars.total')} value={data.total} />
            <MetricCard label={t('pages.regulars.optedIn')} value={data.regulars.filter((r) => r.consent.whatsappOptIn).length} />
          </div>
        )}
      </ComingNext>
    </>
  )
}
