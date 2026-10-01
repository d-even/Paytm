import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Eyelids, type Eye } from './Eyelids'
import { idleRepeats } from './idle'
import { illustrationUrl } from './manifest'

/*
 * Mitra, the mascot, greeting the merchant. The art is split into two layers
 * on the same 540 × 989 canvas (see design/characters/cutout_mitra.py): the
 * raised forearm and hand sit behind the body layer and rotate about the elbow,
 * so the sleeve cuff hides the joint while he waves.
 */
const W = 540
const H = 989
const ELBOW = { x: 72 / W, y: 462 / H }
const EYES: Eye[] = [
  { cx: 253.5, cy: 175, rx: 29, ry: 28, skin: ['#fac394', '#f5b079'] },
  { cx: 351.5, cy: 188, rx: 29, ry: 28, skin: ['#fac394', '#f5b079'] },
]

export function MitraHero({ className }: { className?: string }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  // If the wave layers are ever missing (for example after new art is dropped
  // in as a single file), fall back to the flat illustration.
  const [layered, setLayered] = useState(true)
  const [waves, setWaves] = useState(0)

  const layer = 'absolute inset-0 h-full w-full select-none'

  return (
    <div
      role="img"
      aria-label={t('illustrations.mitraWave')}
      onClick={() => setWaves((n) => n + 1)}
      className={cn('relative select-none [-webkit-tap-highlight-color:transparent]', className)}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      {/* Ground shadow, tightening as he floats up */}
      <motion.div
        aria-hidden
        className="absolute -bottom-[1.5%] left-1/2 h-[4.5%] w-[58%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_46_110/0.3),rgb(0_46_110/0))]"
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1, scaleX: [1, 0.9, 1] }}
        transition={{ opacity: { duration: 0.6, delay: 0.3 }, scaleX: { duration: 5, repeat: idleRepeats(5), ease: 'easeInOut' } }}
      />

      {/* Entrance: rises in and settles with a bounce */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{ originX: 0.5, originY: 1 }}
        initial={reduce ? false : { opacity: 0, y: '10%', scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 13, delay: 0.1 }}
      >
        {/* Hero float */}
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: idleRepeats(5), ease: 'easeInOut' }}
        >
          {layered ? (
            <>
              <motion.img
                key={waves}
                src={illustrationUrl('mitra-wave-hand')}
                alt=""
                draggable={false}
                onError={() => setLayered(false)}
                className={layer}
                style={{ originX: ELBOW.x, originY: ELBOW.y }}
                animate={reduce ? undefined : { rotate: [0, -11, 6, -11, 6, -3, 0] }}
                transition={{
                  duration: 1.9,
                  ease: 'easeInOut',
                  delay: waves === 0 ? 0.9 : 0,
                  // Three waves on arrival; a tap waves once more.
                  repeat: waves === 0 ? 2 : 0,
                  repeatDelay: 3.4,
                }}
              />
              <img
                src={illustrationUrl('mitra-wave-body')}
                alt=""
                draggable={false}
                onError={() => setLayered(false)}
                className={layer}
              />
            </>
          ) : (
            <img src={illustrationUrl('mitra-wave')} alt="" draggable={false} className={layer} />
          )}
          {!reduce && (
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" focusable="false" aria-hidden>
              <Eyelids eyes={EYES} delay={2.1} every={3.9} />
            </svg>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
