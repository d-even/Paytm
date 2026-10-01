import { useTranslation } from 'react-i18next'
import {
  ActivityCard,
  ApprovalsCard,
  AskCard,
  BillCard,
  CardScanCard,
  DipInsightCard,
  MoreSections,
  SoundboxCard,
  TodayCard,
} from '../components/counter'
import { PageHeader } from '../components/layout/PageHeader'

/**
 * The merchant's home screen at the till. Today's sales and the dip insight
 * on top; billing, Ask and links to every other section on the left; the
 * Soundbox, approvals and agent activity on the right. One column on phones.
 */
export function Counter() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('counter.title')} visuallyHidden />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <TodayCard />
        <DipInsightCard />
      </div>
      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:mt-6 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-5 lg:gap-6">
          <CardScanCard />
          <BillCard />
          <AskCard />
          {/* On wide screens the section links fill the shorter left column; phones get them at the end. */}
          <MoreSections className="hidden lg:block" stacked />
        </div>
        <div className="flex flex-col gap-5 lg:gap-6">
          <SoundboxCard />
          <ApprovalsCard />
          <ActivityCard />
        </div>
      </div>
      <MoreSections className="mt-8 lg:hidden" />
    </>
  )
}
