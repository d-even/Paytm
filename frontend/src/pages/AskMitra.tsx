import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'

export function AskMitra() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('pages.ask.title')} subtitle={t('pages.ask.subtitle')} />
      <ComingNext phase={8} items={[t('pages.ask.next1'), t('pages.ask.next2'), t('pages.ask.next3')]} />
    </>
  )
}
