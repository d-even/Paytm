/**
 * Idle loops (float, sway, blink, wave, payment moment) run for about 20
 * seconds and then settle, so nothing keeps moving beside the merchant's
 * decisions (WCAG 2.2.2). Tapping Mitra replays his wave.
 */
export const IDLE_SECONDS = 20

/** How many extra times a loop of `cycleSeconds` repeats within the idle time. */
export const idleRepeats = (cycleSeconds: number) => Math.max(1, Math.round(IDLE_SECONDS / cycleSeconds) - 1)
