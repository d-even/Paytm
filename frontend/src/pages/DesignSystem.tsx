import {
  ArrowRight,
  BadgeIndianRupee,
  HeartHandshake,
  IndianRupee,
  Megaphone,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  Badge,
  ClayButton,
  ClayCard,
  ClaySwitch,
  Container,
  FloatingOrb,
  IconBubble,
  InsightCard,
  MetricCard,
  RiskBadge,
  SectionHeading,
  type InsightStatus,
} from '../components/ui'
import { formatINR } from '../lib/format'

const palette = [
  { name: 'Navy', token: 'navy / ink', hex: '#0A1F44', use: 'Headings, text and icons (never a fill)', swatch: 'bg-navy' },
  { name: 'Paytm Blue', token: 'paytm-blue / accent', hex: '#00BAF2', use: 'Primary actions, live states, data viz', swatch: 'bg-paytm-blue' },
  { name: 'Coral', token: 'coral', hex: '#F23A5C', use: 'Highlights: live, returning, rewards', swatch: 'bg-coral' },
  { name: 'White', token: 'surface', hex: '#FFFFFF', use: 'Cards, with a 1px soft border', swatch: 'bg-surface' },
  { name: 'Page', token: 'canvas', hex: '#F5F7FA', use: 'Page background', swatch: 'bg-canvas' },
]

const tints = [
  { token: 'well', swatch: 'bg-well' },
  { token: 'surface-2', swatch: 'bg-surface-2' },
  { token: 'line', swatch: 'bg-line' },
  { token: 'accent-wash', swatch: 'bg-accent-wash' },
  { token: 'coral-wash', swatch: 'bg-coral-wash' },
  { token: 'success', swatch: 'bg-success' },
  { token: 'caution', swatch: 'bg-caution' },
]

const typeScale = [
  { token: 'text-hero', spec: 'clamp(42px, 6vw, 76px) · 800', sample: 'Now let AI act on it.' },
  { token: 'text-section', spec: 'clamp(32px, 4.2vw, 56px) · 700', sample: 'It doesn’t just analyze.' },
  { token: 'text-card', spec: 'clamp(20px, 1.6vw, 26px) · 600', sample: 'Sales dip detected' },
  { token: 'text-body-lg', spec: '18px / 1.7 · 400', sample: 'Vyapaar Mitra observes your transactions and turns insights into action.' },
  { token: 'text-body', spec: '16px / 1.65 · 400', sample: 'Tuesday revenue is 18% below your weekly average.' },
]

type SampleInsight = {
  id: string
  category: string
  title: string
  body: string
  recommendation?: string
  primaryLabel: string
  icon: ReactNode
  risk: 'low' | 'high'
}

const sampleInsights: SampleInsight[] = [
  {
    id: 'sales-dip',
    category: 'Sales insight',
    title: 'Sales dip detected',
    body: 'Tuesday revenue is 18% below your weekly average.',
    recommendation: 'Launch a Tuesday loyalty offer.',
    primaryLabel: 'Review offer',
    icon: <TrendingDown />,
    risk: 'low',
  },
  {
    id: 'loyalty',
    category: 'Loyalty insight',
    title: '40 regular customers identified',
    body: `12 haven’t visited this week. Potential recovery: ${formatINR(3200)} estimated revenue.`,
    primaryLabel: 'Review',
    icon: <HeartHandshake />,
    risk: 'low',
  },
  {
    id: 'credit',
    category: 'Lending insight',
    title: 'Credit opportunity',
    body: 'Your transaction history may qualify you for a pre-approved credit offer.',
    primaryLabel: 'Review eligibility',
    icon: <BadgeIndianRupee />,
    risk: 'high',
  },
]

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-2xl font-bold tracking-[-0.02em]">
          {title}
        </h2>
        {note && <p className="text-slate">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Phase 1 preview: every token and primitive in one place so the system can be
 * reviewed before the landing page is built on top of it.
 */
export function DesignSystem() {
  const [autoLowRisk, setAutoLowRisk] = useState(true)
  const [insightStatus, setInsightStatus] = useState<Record<string, InsightStatus>>({})

  const setStatus = (id: string, status: InsightStatus) =>
    setInsightStatus((current) => ({ ...current, [id]: status }))

  return (
    <main id="top" className="pt-32 pb-24 sm:pt-36">
      <Container className="flex flex-col gap-20">
        <SectionHeading
          as="h1"
          eyebrow="Design system · Phase 1"
          title={
            <>
              Clay, calm and <span className="text-accent-ink">unmistakably Paytm.</span>
            </>
          }
          description="The tokens, surfaces and components every Vyapaar Mitra screen is built from. This page is a working preview of the system and will be replaced by the landing page in Phase 2."
        />

        <Block id="colors" title="Colour" note="Navy for text, Paytm blue for primary actions, coral for highlights, white cards with soft borders on a light page. Green, amber and red only for risk.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {palette.map((color) => (
              <ClayCard key={color.token} elevation="soft" padding="sm" className="flex flex-col gap-3">
                <span
                  aria-hidden
                  className={`${color.swatch} h-20 rounded-2xl [box-shadow:inset_0_0_0_1px_rgb(10_31_68/0.08),inset_3px_3px_8px_rgb(255_255_255/0.35),inset_-3px_-3px_8px_rgb(10_31_68/0.1)]`}
                />
                <div>
                  <p className="font-semibold text-ink">{color.name}</p>
                  <p className="font-mono text-xs text-slate-soft">
                    {color.hex} · {color.token}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-slate">{color.use}</p>
                </div>
              </ClayCard>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {tints.map((tint) => (
              <span key={tint.token} className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-1.5 text-xs font-medium text-slate [box-shadow:var(--clay-shadow-soft)]">
                <span aria-hidden className={`${tint.swatch} size-6 rounded-full`} />
                {tint.token}
              </span>
            ))}
          </div>
        </Block>

        <Block id="type" title="Typography" note="Poppins, with Inter and system-ui as fallbacks. Bold, short and generously spaced.">
          <ClayCard padding="lg" className="flex flex-col divide-y divide-line">
            {typeScale.map((item) => (
              <div key={item.token} className="grid gap-2 py-5 first:pt-0 last:pb-0 md:grid-cols-[200px_1fr] md:items-baseline md:gap-8">
                <div>
                  <p className="font-mono text-sm font-semibold text-accent-ink">{item.token}</p>
                  <p className="text-xs text-slate-soft">{item.spec}</p>
                </div>
                <p className={`${item.token} ${item.token.startsWith('text-body') ? 'text-slate' : 'text-ink'}`}>
                  {item.sample}
                </p>
              </div>
            ))}
          </ClayCard>
        </Block>

        <Block id="surfaces" title="Clay surfaces" note="Four depths, each tuned rather than copied: raised for primary cards, soft for tiles, inset for wells, blue for emphasis.">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <ClayCard padding="lg" className="flex min-h-44 flex-col justify-end">
              <p className="font-mono text-sm text-accent-ink">clay-card</p>
              <p className="text-card">Raised</p>
            </ClayCard>
            <ClayCard elevation="soft" padding="lg" className="flex min-h-44 flex-col justify-end">
              <p className="font-mono text-sm text-accent-ink">clay-soft</p>
              <p className="text-card">Soft</p>
            </ClayCard>
            <ClayCard elevation="inset" tone="cloud" padding="lg" className="flex min-h-44 flex-col justify-end">
              <p className="font-mono text-sm text-accent-ink">clay-inset</p>
              <p className="text-card">Inset</p>
            </ClayCard>
            <ClayCard tone="blue" padding="lg" className="flex min-h-44 flex-col justify-end">
              <p className="font-mono text-sm">clay-accent</p>
              <p className="text-card">Emphasis</p>
            </ClayCard>
          </div>
        </Block>

        <Block id="buttons" title="Buttons" note="Hover lifts 2px; pressing sinks 2px and squashes to 97%, like pressing a clay object.">
          <ClayCard padding="lg" className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-4">
              <ClayButton size="lg" trailingIcon={<ArrowRight className="size-5" />}>
                See Vyapaar Mitra in Action
              </ClayButton>
              <ClayButton size="lg" variant="accent" leadingIcon={<Sparkles className="size-5" />}>
                Explore the Agent
              </ClayButton>
              <ClayButton size="lg" variant="secondary">
                See How It Works
              </ClayButton>
              <ClayButton size="lg" variant="ghost">
                Not now
              </ClayButton>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ClayButton size="md">Approve Action</ClayButton>
              <ClayButton size="sm">Review Offer</ClayButton>
              <ClayButton size="sm" variant="secondary">
                Dismiss
              </ClayButton>
              <ClayButton size="sm" disabled>
                Disabled
              </ClayButton>
            </div>
          </ClayCard>
        </Block>

        <Block id="signals" title="Orb, icons and trust labels">
          <div className="grid gap-6 lg:grid-cols-3">
            <ClayCard padding="lg" className="flex items-center justify-center gap-6">
              <FloatingOrb size="sm" />
              <FloatingOrb size="md" />
              <FloatingOrb size="lg" float label="Vyapaar Mitra AI" />
            </ClayCard>
            <ClayCard padding="lg" className="flex flex-wrap items-center justify-center gap-4">
              <IconBubble>
                <Sparkles />
              </IconBubble>
              <IconBubble tone="blue">
                <Megaphone />
              </IconBubble>
              <IconBubble tone="cloud">
                <Users />
              </IconBubble>
              <IconBubble tone="success">
                <IndianRupee />
              </IconBubble>
              <IconBubble tone="caution">
                <BadgeIndianRupee />
              </IconBubble>
            </ClayCard>
            <ClayCard padding="lg" className="flex flex-col items-start justify-center gap-3">
              <RiskBadge level="low" />
              <RiskBadge level="high" />
              <Badge tone="success">Offer sent</Badge>
              <Badge>Hackathon prototype</Badge>
            </ClayCard>
          </div>
        </Block>

        <Block id="cards" title="Product cards" note="Metric tiles and AI insight cards, built from the same clay primitives. Try Review and Dismiss.">
          <div className="grid gap-6 sm:grid-cols-3">
            <MetricCard label="Today’s Sales" value={formatINR(12840)} delta={{ label: '14.2%', direction: 'up' }} icon={<IndianRupee />} />
            <MetricCard label="Customers" value="84" delta={{ label: '+12 regulars', direction: 'neutral' }} icon={<Users />} />
            <MetricCard label="AI Opportunities" value="3" delta={{ label: 'Tuesday dip', direction: 'down' }} icon={<Sparkles />} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {sampleInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                category={insight.category}
                title={insight.title}
                body={insight.body}
                recommendation={insight.recommendation}
                primaryLabel={insight.primaryLabel}
                icon={insight.icon}
                risk={insight.risk}
                status={insightStatus[insight.id] ?? 'open'}
                onPrimary={() => setStatus(insight.id, 'reviewed')}
                onDismiss={() => setStatus(insight.id, 'dismissed')}
              />
            ))}
          </div>
        </Block>

        <Block id="controls" title="Merchant control">
          <ClayCard padding="lg" className="flex max-w-xl flex-col gap-6">
            <ClaySwitch
              checked={autoLowRisk}
              onChange={setAutoLowRisk}
              label="Automatic for low-risk actions"
              description={autoLowRisk ? 'Marketing offers and reminders run on their own.' : 'Every action waits for your approval.'}
            />
            <ClaySwitch
              checked
              onChange={() => {}}
              disabled
              label="Approval required for high-stakes actions"
              description="Credit and loan decisions always need you. This can’t be turned off."
            />
          </ClayCard>
        </Block>
      </Container>
    </main>
  )
}
