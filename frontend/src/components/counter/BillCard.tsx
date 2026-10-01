import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Clock3, Gift, Loader2, Nfc, ReceiptIndianRupee, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useMerchant } from '../../hooks/queries'
import { useNow } from '../../hooks/useNow'
import { cn } from '../../lib/cn'
import { formatINR } from '../../lib/format'
import type { Bill, Payment } from '../../mocks/types'
import { useCounter, type BillFlow } from '../../store/counter'
import { ClayButton, ClayCard } from '../ui'
import { QrPattern } from './QrPattern'

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000]
const MAX_AMOUNT = 100_000

/**
 * New bill → QR + "Tap card" with a 60-second expiry → payment received.
 * The Soundbox caption (one shared live region) announces every step, so this
 * card only moves focus to the next useful control when the old one vanishes.
 */
export function BillCard() {
  const { t } = useTranslation()
  const flow = useCounter((s) => s.flow)
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <ClayCard ref={cardRef} as="section" aria-labelledby="bill-title" padding="none" className="overflow-hidden">
      <header className="flex items-center gap-3 px-5 pt-5 sm:px-6">
        <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
          <ReceiptIndianRupee className="size-5" />
        </span>
        <h2 id="bill-title" className="text-lg font-bold">
          {t('counter.bill.title')}
        </h2>
      </header>
      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={flow.step === 'creating' ? 'idle' : flow.step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <FlowStep flow={flow} cardRef={cardRef} />
          </motion.div>
        </AnimatePresence>
      </div>
    </ClayCard>
  )
}

function FlowStep({ flow, cardRef }: { flow: BillFlow; cardRef: RefObject<HTMLDivElement | null> }) {
  switch (flow.step) {
    case 'idle':
    case 'creating':
      return <AmountForm flow={flow} cardRef={cardRef} />
    case 'awaiting':
      return <Awaiting bill={flow.bill} tapping={flow.tapping} error={flow.error} cardRef={cardRef} />
    case 'paid':
      return <Paid payment={flow.payment} cardRef={cardRef} />
    case 'expired':
      return <Expired amount={flow.amount} cardRef={cardRef} />
  }
}

/**
 * Moves focus to `target` when this step appears, but only if focus was in the
 * bill card (or lost to the page), so a bill expiring never pulls focus away
 * from something else the merchant is doing.
 */
function useStepFocus<T extends HTMLElement>(cardRef: RefObject<HTMLDivElement | null>) {
  const target = useRef<T>(null)
  useEffect(() => {
    const active = document.activeElement
    if (active === document.body || active === null || cardRef.current?.contains(active)) {
      target.current?.focus({ preventScroll: true })
    }
    // cardRef is a stable ref object, so this runs once, when the step appears.
  }, [cardRef])
  return target
}

function AmountForm({ flow, cardRef }: { flow: Extract<BillFlow, { step: 'idle' | 'creating' }>; cardRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const createBill = useCounter((s) => s.createBill)
  const cancelBill = useCounter((s) => s.cancelBill)
  const inputRef = useStepFocus<HTMLInputElement>(cardRef)
  const [value, setValue] = useState(() => (flow.amount ? String(flow.amount) : ''))
  const [invalid, setInvalid] = useState(false)
  const inputId = useId()
  const errorId = useId()
  const busy = flow.step === 'creating'
  const amount = Number(value)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
      setInvalid(true)
      inputRef.current?.focus()
      return
    }
    setInvalid(false)
    void createBill(amount)
  }

  const error = invalid ? t('counter.bill.invalid') : flow.step === 'idle' && flow.error === 'create' ? t('counter.bill.createFailed') : null

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {t('counter.bill.amountLabel')}
        </label>
        <div
          className={cn(
            'clay-inset flex h-16 items-center gap-2 rounded-2xl px-4',
            'focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-navy',
            error && invalid && 'ring-2 ring-danger',
          )}
        >
          <span aria-hidden className="text-2xl font-bold text-slate">
            ₹
          </span>
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6))
              setInvalid(false)
            }}
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="go"
            placeholder="0"
            readOnly={busy}
            aria-invalid={invalid || undefined}
            aria-describedby={error ? errorId : undefined}
            size={1}
            className="h-full w-full min-w-0 flex-1 bg-transparent text-3xl font-bold tracking-tight text-ink tabular-nums outline-none placeholder:text-slate-soft/60 focus-visible:outline-none focus-visible:[box-shadow:none]"
          />
        </div>
      </div>

      <div role="group" aria-label={t('counter.bill.quick')} className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((quick) => {
          const selected = amount === quick
          return (
            <button
              key={quick}
              type="button"
              disabled={busy}
              aria-pressed={selected}
              aria-label={t('counter.bill.quickAmount', { amount: formatINR(quick) })}
              onClick={() => {
                setValue(String(quick))
                setInvalid(false)
              }}
              className={cn(
                'h-12 min-w-[4.5rem] rounded-full px-4 text-[15px] font-semibold tabular-nums transition-colors disabled:opacity-60',
                selected
                  ? 'bg-accent text-on-accent [box-shadow:var(--clay-shadow-accent)]'
                  : 'bg-surface text-ink [box-shadow:var(--clay-shadow-soft)] hover:bg-accent-wash',
              )}
            >
              {formatINR(quick)}
            </button>
          )
        })}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <ClayButton
          type="submit"
          size="lg"
          fullWidth
          aria-disabled={busy || undefined}
          leadingIcon={busy ? <Loader2 className="size-5 animate-spin" /> : <ReceiptIndianRupee className="size-5" />}
        >
          {busy ? t('counter.bill.creating') : t('counter.bill.create')}
        </ClayButton>
        {busy && (
          <ClayButton type="button" variant="secondary" size="lg" onClick={cancelBill}>
            {t('counter.bill.cancel')}
          </ClayButton>
        )}
      </div>
    </form>
  )
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Awaiting({
  bill,
  tapping,
  error,
  cardRef,
}: {
  bill: Bill
  tapping: boolean
  error?: 'tap'
  cardRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const tapCard = useCounter((s) => s.tapCard)
  const cancelBill = useCounter((s) => s.cancelBill)
  const { data: merchant } = useMerchant()
  const tapRef = useStepFocus<HTMLButtonElement>(cardRef)
  const now = useNow(250)
  const total = (new Date(bill.expiresAt).getTime() - new Date(bill.createdAt).getTime()) / 1000
  const left = Math.max(0, Math.ceil((new Date(bill.expiresAt).getTime() - now) / 1000))
  const amount = formatINR(bill.amount)
  const urgent = left <= 10

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p className="text-2xl font-bold tracking-tight text-ink">{t('counter.bill.waiting', { amount })}</p>
        <p className={cn('inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums', urgent ? 'text-caution-ink' : 'text-slate')}>
          <Clock3 aria-hidden className="size-4" />
          {t('counter.bill.expiresIn', { time: formatClock(left) })}
        </p>
      </div>
      {/* Time left as a bar; screen readers get one warning at 10 seconds instead of a ticking count. */}
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-well">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-linear', urgent ? 'bg-caution' : 'bg-accent')}
          style={{ width: `${(left / total) * 100}%` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {urgent && left > 0 ? t('counter.bill.expiresSoon') : ''}
      </p>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
        <figure className="flex flex-col items-center gap-2 rounded-[22px] border border-line bg-surface p-4">
          {bill.qrSvg ? (
            // Real backend: a scannable QR that opens the pay page on the customer's phone (same Wi-Fi).
            <div
              role="img"
              aria-label={t('counter.bill.qrLabel', { amount, store: merchant?.storeName ?? '' })}
              className="size-40 sm:size-36 lg:size-40 [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: bill.qrSvg }}
            />
          ) : (
            <QrPattern seed={bill.id} label={t('counter.bill.qrLabel', { amount, store: merchant?.storeName ?? '' })} className="size-40 sm:size-36 lg:size-40" />
          )}
          <figcaption className="text-center text-sm font-medium text-slate">{t('counter.bill.scanQr')}</figcaption>
          {bill.payUrl && (
            <a href={bill.payUrl} target="_blank" rel="noreferrer" className="max-w-full text-center text-xs break-all text-accent-ink underline">
              {t('counter.bill.payLink', { url: bill.payUrl.replace(/^https?:\/\//, '') })}
            </a>
          )}
        </figure>
        <p aria-hidden className="flex items-center justify-center text-xs font-semibold tracking-[0.14em] text-slate-soft uppercase">
          {t('counter.bill.or')}
        </p>
        <button
          ref={tapRef}
          type="button"
          onClick={() => void tapCard()}
          aria-disabled={tapping || undefined}
          aria-describedby="tap-hint"
          className={cn(
            'group flex min-h-40 flex-col items-center justify-center gap-3 rounded-[22px] bg-accent-wash p-4 text-center transition-colors',
            '[box-shadow:var(--clay-rim)] hover:bg-[#d3f2fd] aria-disabled:cursor-progress',
          )}
        >
          <span
            aria-hidden
            className="relative inline-flex size-16 items-center justify-center rounded-full bg-accent text-on-accent [box-shadow:var(--clay-shadow-accent)]"
          >
            {tapping ? <Loader2 className="size-7 animate-spin" /> : <Nfc className="size-8" />}
            {!tapping && <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 motion-reduce:hidden" />}
          </span>
          <span className="text-lg font-bold text-ink">{tapping ? t('counter.bill.reading') : t('counter.bill.tapCard')}</span>
          <span id="tap-hint" className="text-sm text-slate">
            {t('counter.bill.tapCardHint')}
          </span>
        </button>
      </div>

      {error === 'tap' && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          {t('counter.bill.tapFailed')}
        </p>
      )}

      <ClayButton variant="secondary" onClick={cancelBill} disabled={tapping} leadingIcon={<X className="size-4" />} className="self-start">
        {t('counter.bill.cancel')}
      </ClayButton>
    </div>
  )
}

function Paid({ payment, cardRef }: { payment: Payment; cardRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const nextCustomer = useCounter((s) => s.nextCustomer)
  const nextRef = useStepFocus<HTMLButtonElement>(cardRef)
  const { customer } = payment

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <SuccessTick />
        <div className="min-w-0">
          <p className="font-semibold text-success-ink">{t('counter.bill.paidTitle')}</p>
          <p className="text-[40px] leading-none font-extrabold tracking-tight text-ink tabular-nums">{formatINR(payment.amount)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-well px-4 py-3">
          <dt className="text-slate">{t('counter.bill.paidWith')}</dt>
          <dd className="mt-0.5 font-semibold text-ink">{t(payment.source === 'card' ? 'counter.bill.sourceCard' : 'counter.bill.sourceUpi')}</dd>
        </div>
        <div className="rounded-2xl bg-well px-4 py-3">
          <dt className="text-slate">{t('counter.bill.instrument')}</dt>
          <dd className="mt-0.5 font-semibold text-ink tabular-nums">{payment.instrumentMasked}</dd>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-well px-4 py-3">
          <div>
            <dt className="text-slate">{t('counter.bill.customer')}</dt>
            <dd className="mt-0.5 font-semibold text-ink">{customer.returning ? customer.masked : t('counter.bill.newCustomer')}</dd>
          </div>
          {customer.returning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-wash px-3 py-1.5 text-xs font-bold tracking-[0.06em] text-coral-ink">
              <span className="uppercase">{t('counter.bill.returning')}</span>
              <span aria-hidden>·</span>
              <span>{t('counter.bill.visit', { count: customer.visits })}</span>
            </span>
          ) : (
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold tracking-[0.06em] text-ink uppercase">
              {t('counter.bill.newCustomer')}
            </span>
          )}
        </div>
      </dl>

      {customer.rewardDue && (
        <p className="flex items-center gap-3 rounded-2xl border border-coral/30 bg-coral-wash px-4 py-3 font-semibold text-coral-ink">
          <Gift aria-hidden className="size-5 shrink-0" />
          {t('counter.bill.reward', { count: customer.visits })}
        </p>
      )}

      <ClayButton ref={nextRef} size="lg" fullWidth onClick={nextCustomer} leadingIcon={<ReceiptIndianRupee className="size-5" />}>
        {t('counter.bill.nextCustomer')}
      </ClayButton>
    </div>
  )
}

/** Green tick that draws itself, with a small burst of coins (skipped for reduced motion). */
function SuccessTick() {
  const reduce = useReducedMotion()
  const coins = ['#00baf2', '#f23a5c', '#0f9d6b', '#ffc83d', '#00baf2', '#f23a5c', '#ffc83d', '#0f9d6b']
  return (
    <span aria-hidden className="relative inline-flex size-16 shrink-0 items-center justify-center">
      {!reduce &&
        coins.map((color, i) => {
          const angle = (i / coins.length) * Math.PI * 2
          return (
            <motion.span
              key={i}
              className="absolute size-2.5 rounded-full"
              style={{ backgroundColor: color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
              animate={{ x: Math.cos(angle) * 46, y: Math.sin(angle) * 46, opacity: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            />
          )
        })}
      <motion.span
        className="relative inline-flex size-16 items-center justify-center rounded-full bg-success text-white [box-shadow:0_10px_24px_rgb(15_157_107/0.3)]"
        initial={reduce ? false : { scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 260 }}
      >
        <Check className="size-9" strokeWidth={3} />
      </motion.span>
    </span>
  )
}

function Expired({ amount, cardRef }: { amount: number; cardRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const createBill = useCounter((s) => s.createBill)
  const nextCustomer = useCounter((s) => s.nextCustomer)
  const againRef = useStepFocus<HTMLButtonElement>(cardRef)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-2xl bg-caution-wash px-4 py-3">
        <Clock3 aria-hidden className="mt-0.5 size-5 shrink-0 text-caution-ink" />
        <div>
          <p className="font-semibold text-ink">{t('counter.bill.expiredTitle')}</p>
          <p className="text-sm text-slate">{t('counter.bill.expiredBody')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <ClayButton ref={againRef} onClick={() => void createBill(amount)} leadingIcon={<RotateCcw className="size-4" />}>
          {t('counter.bill.createAgain', { amount: formatINR(amount) })}
        </ClayButton>
        <ClayButton variant="secondary" onClick={nextCustomer}>
          {t('counter.bill.newBill')}
        </ClayButton>
      </div>
    </div>
  )
}
