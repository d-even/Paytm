import type { RiskLevel } from '../../mocks/types'
import { cn } from '../../lib/cn'
import { RISK_DOT } from './copy'

/** Plain-words stakes ("Small spend", "Big decision") with a risk-coloured dot. */
export function StakesLabel({ risk, children }: { risk: RiskLevel; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-well px-2.5 py-1 text-xs font-semibold text-slate">
      <span aria-hidden className={cn('size-2 rounded-full', RISK_DOT[risk])} />
      {children}
    </span>
  )
}
