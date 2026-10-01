import { Lock, Zap } from 'lucide-react'
import { Badge } from './Badge'

export type RiskLevel = 'low' | 'high'

/**
 * Communicates the trust engine rule on any action:
 * low-risk actions can auto-execute, high-stakes ones are recommend-only.
 */
export function RiskBadge({ level }: { level: RiskLevel }) {
  return level === 'low' ? (
    <Badge tone="cyan" icon={<Zap />}>Auto-execute</Badge>
  ) : (
    <Badge tone="caution" icon={<Lock />}>Recommendation only</Badge>
  )
}
