import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, Sparkles, Speaker, Sunrise } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useActions, useInsights, useRunAgent } from '../../hooks/queries'
import { getLanguage } from '../../i18n/languages'
import { cn } from '../../lib/cn'
import { speechSupported } from '../../lib/speech'
import type { AgentRunReport } from '../../mocks/types'
import { useCounter, type Line } from '../../store/counter'
import { useSession } from '../../store/session'
import { ClayButton, ClayCard, ClaySwitch } from '../ui'
import { clockTime, lineText } from './lines'

const STEPS = ['stepObserve', 'stepReason', 'stepDecide', 'stepAct', 'stepLearn'] as const
const STEP_MS = 500
/** Within this many percent of a usual day counts as "in line". */
const ON_TRACK_PCT = 5
/** Early in the day the comparison swings wildly, so it is capped. */
const MAX_PACE_PCT = 60

/**
 * What an agent run says. The pace line goes to the feed; a new action shows
 * up in the feed on its own (from the actions list), so it is only the caption.
 */
function runLines(report: AgentRunReport, undoMinutes: number): { feed: Line[]; caption: Line } {
  const pct = Math.min(Math.abs(report.pacePct), MAX_PACE_PCT)
  const pace: Line =
    pct <= ON_TRACK_PCT
      ? { key: 'counter.lines.agentOnTrack', params: { today: report.today.sales } }
      : {
          key: report.pacePct > 0 ? 'counter.lines.agentAhead' : 'counter.lines.agentBehind',
          params: { today: report.today.sales, pct },
        }
  const action = report.newAction
  if (action) {
    return {
      feed: [pace],
      caption: {
        key: action.status === 'auto_done' ? 'counter.lines.agentNewAuto' : 'counter.lines.agentNewPending',
        params: { type: action.type, cost: action.costCap, minutes: undoMinutes },
      },
    }
  }
  const outcome: Line = report.skippedType
    ? { key: 'counter.lines.agentSkipped', params: { type: report.skippedType } }
    : { key: 'counter.lines.agentNothingNew' }
  return { feed: [pace, outcome], caption: outcome }
}

/**
 * The counter Soundbox: a live caption of what it last said, the voice switch,
 * the morning briefing and "Run agent now" (with the Observe → Learn steps).
 * The caption is the counter's single live region for screen readers.
 */
export function SoundboxCard() {
  const { t, i18n } = useTranslation()
  const language = useSession((s) => s.language)
  const caption = useCounter((s) => s.caption)
  const voiceOn = useCounter((s) => s.voiceOn)
  const speaking = useCounter((s) => s.speaking)
  const setVoice = useCounter((s) => s.setVoice)
  const today = useCounter((s) => s.today)
  const { data: insights } = useInsights()
  const { data: actions } = useActions()
  const canSpeak = speechSupported()

  const run = useRunAgent((report) => {
    const { say, log, setToday } = useCounter.getState()
    setToday(report.today)
    const undoMinutes = report.newAction?.undoUntil
      ? Math.round((new Date(report.newAction.undoUntil).getTime() - new Date(report.ranAt).getTime()) / 60_000)
      : 0
    const { feed, caption } = runLines(report, undoMinutes)
    feed.forEach((line) => log('agent', line))
    say(caption)
  })

  const playBriefing = () => {
    if (!insights || !today) return
    const { yesterday } = insights.briefing
    const pending = actions?.filter((a) => a.status === 'pending').length ?? 0
    const { say, log } = useCounter.getState()
    say({
      key: 'counter.lines.briefing',
      params: {
        name: insights.briefing.greetingName,
        yesterday: yesterday.sales,
        pct: Math.abs(yesterday.comparison.changePct),
        day: yesterday.dayLabel,
        today: today.sales,
        count: pending,
      },
    })
    log('briefing', { key: 'counter.lines.briefingPlayed' })
  }

  const locale = getLanguage(language).htmlLang

  return (
    <ClayCard as="section" aria-labelledby="soundbox-title" padding="none">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
            <Speaker className="size-5" />
          </span>
          <h2 id="soundbox-title" className="text-lg font-bold">
            {t('counter.soundbox.title')}
          </h2>
        </div>
        {canSpeak && (
          <ClaySwitch checked={voiceOn} onChange={setVoice} label={t('counter.soundbox.voice')} className="gap-3" />
        )}
      </header>

      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        <div className="clay-inset flex min-h-32 flex-col gap-2 rounded-[22px] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-eyebrow text-accent-ink uppercase">{t('counter.soundbox.caption')}</p>
            <div className="flex items-center gap-2 text-xs text-slate-soft">
              {speaking && <Equalizer />}
              {caption && !run.isPending && <time dateTime={new Date(caption.at).toISOString()}>{clockTime(caption.at, locale)}</time>}
            </div>
          </div>
          {run.isPending && <AgentSteps />}
          {/* Always mounted, so screen readers hear each new caption (it hides behind the steps during a run). */}
          <p aria-live="polite" className={cn('text-lg leading-snug font-semibold text-ink', run.isPending && 'sr-only')}>
            {caption ? lineText(i18n.t, caption.line) : t('counter.soundbox.idle')}
          </p>
        </div>

        {!canSpeak ? (
          <p className="mt-3 text-sm text-slate-soft">{t('counter.soundbox.voiceUnsupported')}</p>
        ) : (
          !voiceOn && <p className="mt-3 text-sm text-slate-soft">{t('counter.soundbox.voiceOffNote')}</p>
        )}
        {run.isError && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">
            {t('counter.soundbox.runFailed')}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ClayButton
            variant="secondary"
            onClick={playBriefing}
            aria-disabled={!insights || !today || undefined}
            leadingIcon={<Sunrise className="size-[18px]" />}
          >
            {t('counter.soundbox.briefing')}
          </ClayButton>
          <ClayButton
            onClick={() => !run.isPending && run.mutate()}
            aria-disabled={run.isPending || undefined}
            leadingIcon={run.isPending ? <Loader2 className="size-[18px] animate-spin" /> : <Sparkles className="size-[18px]" />}
          >
            {run.isPending ? t('counter.soundbox.running') : t('counter.soundbox.runAgent')}
          </ClayButton>
        </div>
      </div>
    </ClayCard>
  )
}

/** Observe → Reason → Decide → Act → Learn, ticking off while the agent runs. */
function AgentSteps() {
  const { t } = useTranslation()
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setActive((i) => Math.min(i + 1, STEPS.length - 1)), STEP_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <ol aria-label={t('counter.soundbox.running')} className="flex flex-col gap-1.5">
      {STEPS.map((step, i) => {
        const done = i < active
        const current = i === active
        return (
          <li
            key={step}
            aria-current={current ? 'step' : undefined}
            className={cn('flex items-center gap-2.5 text-sm', done ? 'text-slate' : current ? 'font-semibold text-ink' : 'text-slate-soft')}
          >
            <span
              aria-hidden
              className={cn(
                'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
                done ? 'bg-success text-white' : current ? 'bg-accent text-on-accent' : 'bg-line',
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : current ? <Loader2 className="size-3 animate-spin" /> : null}
            </span>
            {t(`counter.soundbox.${step}`)}
          </li>
        )
      })}
    </ol>
  )
}

/** Three bars that bounce while the Soundbox is talking. */
function Equalizer() {
  return (
    <AnimatePresence>
      <motion.span aria-hidden className="flex h-4 items-end gap-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-coral"
            animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </motion.span>
    </AnimatePresence>
  )
}
