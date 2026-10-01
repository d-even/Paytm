import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, Link2, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useCounter } from '../../store/counter'
import { ClayButton, ClayCard } from '../ui'

/**
 * Shown when a card is tapped on the ESP32 reader while no bill is open.
 * A known card shows whose it is; a new card can be linked to a saved
 * customer in one tap, so their visit history follows the card from now on.
 * Only appears with the real backend (the mock has no reader).
 */
export function CardScanCard() {
  const { t } = useTranslation()
  const card = useCounter((s) => s.scannedCard)
  const setScannedCard = useCounter((s) => s.setScannedCard)
  const [done, setDone] = useState<string | null>(null)

  const customers = useQuery({
    queryKey: ['named-customers'],
    queryFn: api.getNamedCustomers,
    enabled: Boolean(card && !card.known),
  })
  const link = useMutation({
    mutationFn: api.linkCard,
    onSuccess: (res) => setDone(res.label),
  })

  if (!card) return null
  const close = () => {
    setDone(null)
    link.reset()
    setScannedCard(null)
  }

  return (
    <ClayCard as="section" aria-labelledby="card-scan-title" padding="none" className="flex flex-col gap-3 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-coral-wash text-coral-ink">
            <CreditCard className="size-5" />
          </span>
          <div>
            <h2 id="card-scan-title" className="text-lg font-bold">
              {t('counter.card.title')}
            </h2>
            <p className="text-sm text-slate tabular-nums">{t('counter.card.cardId', { id: card.rfidUid.slice(-4) })}</p>
          </div>
        </div>
        <button type="button" onClick={close} aria-label={t('counter.card.dismiss')} className="rounded-full p-2 text-slate hover:bg-well">
          <X className="size-5" />
        </button>
      </div>

      {done ? (
        <p role="status" className="font-semibold text-success-ink">
          {t('counter.card.linked', { name: done })}
        </p>
      ) : card.known ? (
        <p className="font-semibold text-ink">{t('counter.card.known', { name: card.label ?? '', count: card.visits })}</p>
      ) : (
        <>
          <p className="text-ink">{t('counter.card.unknown')}</p>
          {customers.isPending ? (
            <Loader2 aria-hidden className="size-5 animate-spin text-slate" />
          ) : customers.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {customers.data.map((c) => (
                <ClayButton
                  key={c.id}
                  variant="secondary"
                  size="sm"
                  disabled={link.isPending}
                  leadingIcon={<Link2 className="size-4" />}
                  onClick={() => link.mutate({ rfidUid: card.rfidUid, customerId: c.id })}
                >
                  {t('counter.card.linkTo', { name: c.name })}
                </ClayButton>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate">{t('counter.card.noNamed')}</p>
          )}
          {link.isError && (
            <p role="alert" className="text-sm font-medium text-danger-ink">
              {t('counter.card.failed')}
            </p>
          )}
        </>
      )}
    </ClayCard>
  )
}
