import { motion } from 'framer-motion'
import { IndianRupee } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getLanguage } from '../../i18n/languages'
import { formatINR } from '../../lib/format'
import { useSession } from '../../store/session'
import { useCounter } from '../../store/counter'
import { ClayButton, ClayCard, Skeleton } from '../ui'
import { clockTime } from './lines'

/** Today's takings, straight from the shared counter store. */
export function TodayCard() {
  const { t } = useTranslation()
  const today = useCounter((s) => s.today)
  const failed = useCounter((s) => s.todayError)
  const loadToday = useCounter((s) => s.loadToday)
  const language = useSession((s) => s.language)
  const last = today?.recent[0]

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  return (
    <ClayCard as="section" aria-labelledby="today-title" padding="none" className="flex flex-col gap-1 px-5 py-5 sm:px-6">
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-lg bg-success-wash text-success-ink">
          <IndianRupee className="size-4" />
        </span>
        <h2 id="today-title" className="text-sm font-semibold text-slate">
          {t('counter.today.label')}
        </h2>
      </div>
      {today ? (
        <>
          <p className="overflow-hidden text-[40px] leading-tight font-extrabold tracking-[-0.03em] text-ink tabular-nums sm:text-[48px]">
            <motion.span
              key={today.sales}
              className="inline-block"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            >
              {formatINR(today.sales)}
            </motion.span>
          </p>
          <p className="text-sm text-slate">
            {t('counter.today.payments', { count: today.count })}
            <span aria-hidden className="px-1.5">·</span>
            {t('counter.today.returning', { count: today.returning })}
          </p>
          {last && (
            <p className="mt-auto pt-3 text-sm text-slate-soft">
              {t('counter.today.last', { amount: formatINR(last.amount), time: clockTime(last.paidAt, getLanguage(language).htmlLang) })}
            </p>
          )}
        </>
      ) : failed ? (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <p className="text-sm text-slate">{t('common.loadErrorBody')}</p>
          <ClayButton variant="secondary" size="sm" onClick={() => void loadToday()}>
            {t('common.tryAgain')}
          </ClayButton>
        </div>
      ) : (
        <>
          <Skeleton className="mt-1 h-12 w-48" />
          <Skeleton className="mt-2 h-4 w-56" />
        </>
      )}
    </ClayCard>
  )
}
