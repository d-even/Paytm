import { useNavigate } from 'react-router-dom'
import { ClayButton, ClayCard } from '../components/ui'
import { useTranslation } from 'react-i18next'

export function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <ClayCard padding="lg" className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
      <p className="text-card">{t('common.notFound')}</p>
      <ClayButton onClick={() => navigate('/')}>{t('common.goHome')}</ClayButton>
    </ClayCard>
  )
}
