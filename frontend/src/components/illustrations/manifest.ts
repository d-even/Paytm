/**
 * Every illustration the app uses. Files live in public/illustrations as
 * transparent WebP under 60 KB. To swap in final art, replace the file with one
 * of the same name (keep a similar aspect ratio, or update the size here).
 *
 * `placeholder: true` marks art drawn by design/illustrations/placeholders.mjs
 * that is waiting for final artwork.
 */
export const ILLUSTRATIONS = {
  // Mitra, the mascot
  'mitra-wave': { width: 540, height: 989, use: 'Login and Home hero (static version)' },
  'mitra-wave-body': { width: 540, height: 989, use: 'Hero wave animation: everything except the raised arm' },
  'mitra-wave-hand': { width: 540, height: 989, use: 'Hero wave animation: the raised arm, rotated about the elbow' },
  'mitra-avatar': { width: 256, height: 256, use: 'Ask Mitra chat avatar' },
  'mitra-thinking': { width: 600, height: 800, use: 'Agent thinking / loading', placeholder: true },
  'mitra-empty': { width: 600, height: 800, use: 'Empty states', placeholder: true },
  'mitra-error': { width: 600, height: 800, use: 'Error states', placeholder: true },
  'mitra-celebrate': { width: 600, height: 800, use: 'Celebration after a win', placeholder: true },
  // Supporting characters
  'merchant-payment': { width: 601, height: 1261, use: 'Merchant receiving a payment (onboarding)' },
  // Insight types (no clay art for loans: the credit insight uses a plain icon)
  'insight-sales-dip': { width: 256, height: 256, use: 'Insight: sales dip', placeholder: true },
  'insight-loyalty': { width: 256, height: 256, use: 'Insight: loyal customer / reward', placeholder: true },
  'insight-cash-crunch': { width: 256, height: 256, use: 'Insight: cash may run short', placeholder: true },
  'insight-reorder': { width: 256, height: 256, use: 'Insight: reorder stock', placeholder: true },
  // Agent loop: Observe → Reason → Decide → Act → Learn
  'loop-observe': { width: 256, height: 256, use: 'Agent loop step 1: Observe', placeholder: true },
  'loop-reason': { width: 256, height: 256, use: 'Agent loop step 2: Reason', placeholder: true },
  'loop-decide': { width: 256, height: 256, use: 'Agent loop step 3: Decide', placeholder: true },
  'loop-act': { width: 256, height: 256, use: 'Agent loop step 4: Act', placeholder: true },
  'loop-learn': { width: 256, height: 256, use: 'Agent loop step 5: Learn', placeholder: true },
  // Celebrations
  'celebrate-coins': { width: 256, height: 256, use: 'Coins burst on Approve', placeholder: true },
  'celebrate-confetti': { width: 256, height: 256, use: 'Confetti on the +30% result', placeholder: true },
} satisfies Record<string, { width: number; height: number; use: string; placeholder?: boolean }>

export type IllustrationName = keyof typeof ILLUSTRATIONS

/** Works from the site root and from the relative static build alike. */
export function illustrationUrl(name: IllustrationName): string {
  return `${import.meta.env.BASE_URL}illustrations/${name}.webp`
}
