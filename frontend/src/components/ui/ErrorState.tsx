import { RefreshCw, WifiOff } from 'lucide-react'
import { ClayButton } from './ClayButton'
import { ClayCard } from './ClayCard'
import { IconBubble } from './IconBubble'
import { useTranslation } from 'react-i18next'

/** Friendly failure message with a retry button. */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  return (
    <ClayCard role="alert" padding="lg" className="flex flex-col items-center gap-4 text-center">
      <IconBubble tone="caution" size="lg">
        <WifiOff />
      </IconBubble>
      <div>
        <p className="text-card">{title ?? t('common.loadErrorTitle')}</p>
        <p className="mt-1 text-slate">{message ?? t('common.loadErrorBody')}</p>
      </div>
      {onRetry && (
        <ClayButton variant="secondary" onClick={onRetry} leadingIcon={<RefreshCw className="size-4" />}>
          {t('common.tryAgain')}
        </ClayButton>
      )}
    </ClayCard>
  )
}
