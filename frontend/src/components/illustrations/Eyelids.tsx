import { motion } from 'framer-motion'
import { useId } from 'react'
import { idleRepeats } from './idle'

export type Eye = {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Skin tones sampled just above the eye, light centre to darker edge. */
  skin: [string, string]
}

/**
 * Blinking eyelids drawn over a flat illustration, inside the illustration's
 * own SVG coordinate space. Each lid drops from the top, clipped to the eye
 * with a soft edge, and a closed-eye smile line shows at the bottom of the
 * blink. Render only when motion is allowed.
 */
export function Eyelids({ eyes, delay = 2.4, every = 4.4, lash = '#2b1d17' }: { eyes: Eye[]; delay?: number; every?: number; lash?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const blink = { duration: 0.26, repeat: idleRepeats(every), repeatDelay: every, delay }
  return (
    <g aria-hidden>
      <defs>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        {eyes.map((e, i) => (
          <g key={i}>
            <linearGradient id={`${uid}-lid-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={e.skin[1]} />
              <stop offset="0.45" stopColor={e.skin[0]} />
              <stop offset="0.88" stopColor={e.skin[1]} />
              <stop offset="0.92" stopColor={lash} />
              <stop offset="1" stopColor={lash} />
            </linearGradient>
            <mask
              id={`${uid}-eye-${i}`}
              maskUnits="userSpaceOnUse"
              x={e.cx - e.rx - 10}
              y={e.cy - e.ry - 10}
              width={2 * e.rx + 20}
              height={2 * e.ry + 20}
            >
              <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="#fff" filter={`url(#${uid}-soft)`} />
            </mask>
          </g>
        ))}
      </defs>
      {eyes.map((e, i) => (
        <g key={i}>
          <g mask={`url(#${uid}-eye-${i})`}>
            <motion.rect
              x={e.cx - e.rx - 6}
              y={e.cy - e.ry - 6}
              width={2 * e.rx + 12}
              height={2 * e.ry + 12}
              fill={`url(#${uid}-lid-${i})`}
              style={{ originY: 0 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 1, 0] }}
              transition={{ ...blink, times: [0, 0.4, 0.6, 1] }}
            />
          </g>
          <motion.path
            d={`M ${e.cx - e.rx + 6} ${e.cy + e.ry * 0.1} Q ${e.cx} ${e.cy + e.ry * 0.8} ${e.cx + e.rx - 6} ${e.cy + e.ry * 0.1}`}
            fill="none"
            stroke={lash}
            strokeWidth={4.5}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
            transition={{ ...blink, times: [0, 0.32, 0.4, 0.6, 0.68, 1] }}
          />
        </g>
      ))}
    </g>
  )
}
