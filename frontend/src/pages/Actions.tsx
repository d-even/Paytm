import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'
import { ErrorState, MetricCard, Skeleton } from '../components/ui'
import { useActions } from '../hooks/queries'
import type { ActionStatus } from '../mocks/types'

export function Actions() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useActions()
  const count = (statuses: ActionStatus[]) => data?.filter((a) => statuses.includes(a.status)).length ?? 0

  return (
    <>
      <PageHeader title={t('pages.actions.title')} subtitle={t('pages.actions.subtitle')} />
      <ComingNext phase={4} items={[t('pages.actions.next1'), t('pages.actions.next2'), t('pages.actions.next3')]}>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <Skeleton className="h-36 rounded-clay" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label={t('pages.actions.needsApproval')} value={count(['pending'])} />
            <MetricCard label={t('pages.actions.doneAutomatically')} value={count(['auto_done', 'paused', 'undone'])} />
            <MetricCard label={t('pages.actions.completed')} value={count(['completed', 'approved', 'rejected'])} />
          </div>
        )}
      </ComingNext>
    </>
  )
}
