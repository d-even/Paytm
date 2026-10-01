import { useMemo } from 'react'

const SIZE = 25

/** Small seeded generator, so a bill always draws the same pattern. */
function seeded(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function inFinder(x: number, y: number) {
  const corners = [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ]
  return corners.some(([cx, cy]) => x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7)
}

/**
 * A QR-style pattern for the bill. It is deliberately not a scannable code:
 * the prototype has no real UPI handle, so a phone scanning it must not open
 * a payment. When the backend sends a real QR payload, render that instead.
 */
export function QrPattern({ seed, label, className }: { seed: string; label: string; className?: string }) {
  const cells = useMemo(() => {
    const rand = seeded(seed)
    const out: [number, number][] = []
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!inFinder(x, y) && rand() > 0.52) out.push([x, y])
      }
    }
    return out
  }, [seed])

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} rx={1.4} fill="#0a1f44" />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={1} fill="#ffffff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.7} fill="#0a1f44" />
    </g>
  )

  return (
    <svg viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`} role="img" aria-label={label} className={className}>
      <rect x={-2} y={-2} width={SIZE + 4} height={SIZE + 4} rx={2.5} fill="#ffffff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.22} fill="#0a1f44" />
      ))}
      {finder(0, 0)}
      {finder(SIZE - 7, 0)}
      {finder(0, SIZE - 7)}
      {/* Centre badge, like the Paytm QR stand */}
      <rect x={SIZE / 2 - 3} y={SIZE / 2 - 3} width={6} height={6} rx={1.6} fill="#ffffff" />
      <circle cx={SIZE / 2} cy={SIZE / 2} r={2.2} fill="#00baf2" />
      <text x={SIZE / 2} y={SIZE / 2 + 0.95} textAnchor="middle" fontSize={2.8} fontWeight={700} fill="#0a1f44">
        ₹
      </text>
    </svg>
  )
}
