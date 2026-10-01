import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Eyelids, type Eye } from './Eyelids'
import { IDLE_SECONDS, idleRepeats } from './idle'
import { illustrationUrl } from './manifest'

/*
 * A merchant receiving a payment: supporting art beside Mitra, the mascot.
 * She is one flat illustration, so she is brought to life with
 * overlays drawn in the image's own pixel space (601 × 1261): eyelids for a
 * blink, a pulse on the phone's "Payment Successful" tick, and the soundbox
 * lighting up with sound waves. Coordinates were measured on the cutout made by
 * design/characters/cutout_shopkeeper.py.
 */
const W = 601
const H = 1261

const EYES: Eye[] = [
  { cx: 217, cy: 280, rx: 45, ry: 40, skin: ['#f9c49a', '#f1b284'] },
  { cx: 391, cy: 313, rx: 43, ry: 37, skin: ['#fbc79d', '#f0b082'] },
]
const PHONE_TICK = { x: 96, y: 513 }
const SOUNDBOX = { x: 504, y: 548 }
const SOUNDBOX_LED = { x: 477, y: 606 }

const EASE = [0.22, 1, 0.36, 1] as const
/** A payment "lands" a few times after she appears, then she settles. */
const PAYMENT_EVERY_MS = 9000
const PAYMENT_TIMES = Math.max(1, Math.floor((IDLE_SECONDS * 1000) / PAYMENT_EVERY_MS))
const PAYMENT_SHOWN_MS = 2800

export type MerchantPaymentProps = {
  className?: string
  /** Rupees announced by the soundbox bubble. */
  amount?: number
}

export function MerchantPayment({ className, amount = 250 }: MerchantPaymentProps) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate()
  const glowId = `${useId().replace(/[^a-zA-Z0-9-]/g, '')}-glow`
  const [paid, setPaid] = useState(false)
  const hideTimer = useRef<number | undefined>(undefined)

  // One "payment received" moment: she leans toward the phone while the
  // soundbox lights up and announces the amount.
  const playPayment = useCallback(() => {
    setPaid(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setPaid(false), PAYMENT_SHOWN_MS)
  }, [])

  useEffect(() => {
    if (reduce) return
    const timers = Array.from({ length: PAYMENT_TIMES }, (_, i) => window.setTimeout(playPayment, 1700 + i * PAYMENT_EVERY_MS))
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      window.clearTimeout(hideTimer.current)
    }
  }, [reduce, playPayment])

  // A tap makes her hop and replays the payment moment.
  const onTap = () => {
    if (reduce || !scope.current) return
    void animate(
      scope.current,
      { y: [0, -26, 0, -6, 0], scaleY: [1, 1.03, 0.97, 1.01, 1] },
      { duration: 0.75, ease: 'easeOut' },
    )
    playPayment()
  }

  // Without motion she simply stands with the payment bubble showing.
  const showBubble = reduce || paid

  return (
    <div
      role="img"
      aria-label={t('illustrations.merchantPayment')}
      onClick={onTap}
      className={cn('relative select-none [-webkit-tap-highlight-color:transparent]', className)}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      {/* Ground shadow: soft, and it tightens when she hops or sways. */}
      <motion.div
        aria-hidden
        className="absolute -bottom-[1.2%] left-1/2 h-[4.5%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_46_110/0.28),rgb(0_46_110/0))]"
        initial={reduce ? false : { opacity: 0, scaleX: 0.4 }}
        animate={reduce ? undefined : { opacity: 1, scaleX: [1, 0.96, 1] }}
        transition={{ opacity: { duration: 0.6, delay: 0.35 }, scaleX: { duration: 3.6, repeat: idleRepeats(3.6), ease: 'easeInOut' } }}
      />

      {/* Entrance: she steps in from the side and settles with a small bounce. */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{ originX: 0.5, originY: 1 }}
        initial={reduce ? false : { opacity: 0, x: '18%', y: '4%', rotate: 5, scale: 0.94 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 14, mass: 0.9, delay: 0.1 }}
      >
        {/* Tap hop */}
        <div ref={scope} className="absolute inset-0" style={{ transformOrigin: '50% 100%' }}>
          {/* Lean toward the phone when a payment lands */}
          <motion.div
            className="absolute inset-0"
            style={{ originX: 0.5, originY: 1 }}
            animate={reduce ? undefined : { rotate: paid ? -2.6 : 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {/* Idle: gentle sway and breathing */}
            <motion.div
              className="absolute inset-0"
              style={{ originX: 0.5, originY: 1 }}
              animate={reduce ? undefined : { rotate: [0, 0.9, 0, -0.9, 0], scaleY: [1, 1.008, 1, 1.008, 1] }}
              transition={{ duration: 7, repeat: idleRepeats(7), ease: 'easeInOut' }}
            >
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full overflow-visible" focusable="false">
                <defs>
                  <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>

                <image href={illustrationUrl('merchant-payment')} width={W} height={H} />

                {!reduce && <Eyelids eyes={EYES} lash="#4a2e22" />}

                <AnimatePresence>
                  {paid && !reduce && (
                    <motion.g key="payment" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
                      {/* Pulse rings on the phone's success tick */}
                      {[0, 0.45].map((delay) => (
                        <motion.circle
                          key={delay}
                          cx={PHONE_TICK.x}
                          cy={PHONE_TICK.y}
                          fill="none"
                          stroke="#0f9d6b"
                          strokeWidth={4}
                          initial={{ r: 18, opacity: 0.8 }}
                          animate={{ r: 70, opacity: 0 }}
                          transition={{ duration: 1.1, delay, ease: 'easeOut' }}
                        />
                      ))}
                      {/* Soundbox light */}
                      <motion.circle
                        cx={SOUNDBOX_LED.x}
                        cy={SOUNDBOX_LED.y}
                        r={20}
                        fill="#3ddc84"
                        filter={`url(#${glowId})`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.95, 0.35, 0.95, 0.35, 0.8] }}
                        transition={{ duration: 1.8, ease: 'easeInOut' }}
                      />
                      {/* Sound waves from the soundbox */}
                      {[0, 1, 2].map((i) => {
                        const r = 108 + i * 26
                        const a = (deg: number) => (deg * Math.PI) / 180
                        const x1 = SOUNDBOX.x + r * Math.cos(a(-40))
                        const y1 = SOUNDBOX.y + r * Math.sin(a(-40))
                        const x2 = SOUNDBOX.x + r * Math.cos(a(22))
                        const y2 = SOUNDBOX.y + r * Math.sin(a(22))
                        return (
                          <motion.path
                            key={i}
                            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                            fill="none"
                            stroke="#00baf2"
                            strokeWidth={9}
                            strokeLinecap="round"
                            initial={{ opacity: 0, pathLength: 0.3 }}
                            animate={{ opacity: [0, 1, 0], pathLength: 1 }}
                            transition={{ duration: 1.1, delay: 0.15 + i * 0.18, repeat: 1, repeatDelay: 0.2 }}
                          />
                        )
                      })}
                    </motion.g>
                  )}
                </AnimatePresence>
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* What the soundbox says */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            aria-hidden
            key="bubble"
            className="absolute top-[27%] left-[64%] z-10 flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink [box-shadow:var(--clay-shadow-soft)] sm:text-[15px]"
            initial={reduce ? false : { opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -6, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 20, delay: reduce ? 0 : 0.2 }}
            style={{ originX: 0, originY: 1 }}
          >
            <Volume2 className="size-4 shrink-0 text-accent-ink" strokeWidth={2.4} />
            {t('illustrations.paymentReceived', { amount: `₹${amount.toLocaleString('en-IN')}` })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
