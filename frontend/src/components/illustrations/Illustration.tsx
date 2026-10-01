import { motion, useReducedMotion } from 'framer-motion'
import type { ImgHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { idleRepeats } from './idle'
import { ILLUSTRATIONS, illustrationUrl, type IllustrationName } from './manifest'

export type IllustrationProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'alt'> & {
  name: IllustrationName
  /** Describe the picture when it carries meaning; leave empty when it is decoration beside text. */
  alt?: string
  /** Hero art loads eagerly and floats gently; everything else is lazy and still. */
  hero?: boolean
}

/**
 * A clay illustration from public/illustrations. Width and height are always
 * set, so the layout never jumps while the WebP loads.
 */
export function Illustration({ name, alt = '', hero = false, className, ...rest }: IllustrationProps) {
  const reduce = useReducedMotion()
  const { width, height } = ILLUSTRATIONS[name]
  const img = (
    <img
      src={illustrationUrl(name)}
      width={width}
      height={height}
      alt={alt}
      loading={hero ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('h-auto max-w-full select-none', !hero && className)}
      {...rest}
    />
  )
  if (!hero || reduce) return hero ? <span className={cn('inline-block', className)}>{img}</span> : img
  return (
    <motion.span
      className={cn('inline-block', className)}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: idleRepeats(5), ease: 'easeInOut' }}
    >
      {img}
    </motion.span>
  )
}
