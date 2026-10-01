import { useTranslation } from 'react-i18next'
import { useOnline } from '../../hooks/useOnline'
import { cn } from '../../lib/cn'

/** Coral "Live" dot in the header; grey "Offline" when the connection drops. */
export function LiveIndicator({ className }: { className?: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  return (
    <span
      title={online ? t('shell.liveHint') : t('shell.offlineHint')}
      className={cn('inline-flex shrink-0 items-center gap-2 text-sm font-semibold', online ? 'text-ink' : 'text-slate-soft', className)}
    >
      <span aria-hidden className="relative inline-flex size-2.5">
        {online && <span className="absolute inset-0 animate-ping rounded-full bg-coral/60 motion-reduce:hidden" />}
        <span className={cn('relative inline-flex size-2.5 rounded-full', online ? 'bg-coral' : 'bg-line-strong')} />
      </span>
      <span className="max-[359px]:sr-only">{online ? t('shell.live') : t('shell.offline')}</span>
      <span className="sr-only">: {online ? t('shell.liveHint') : t('shell.offlineHint')}</span>
    </span>
  )
}
