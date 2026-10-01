import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, MessageCircleQuestion, RefreshCw, SendHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import type { QueryCard } from '../../mocks/types'
import { useCounter } from '../../store/counter'
import { useSession } from '../../store/session'
import { ClayButton, ClayCard } from '../ui'

const CHIPS = ['chipToday', 'chipLast', 'chipRegulars', 'chipDip', 'chipLoan'] as const
type Chip = (typeof CHIPS)[number]

/** A chip is kept as its id, so its wording follows the language switch. */
type Question = { chip: Chip } | { text: string }

/**
 * Ask Vyapaar Mitra on the counter. Answers come from POST /agent/query and
 * are keyed on the shared store's payment `revision`, so an answer on screen
 * is fetched again (in place) after every payment.
 */
export function AskCard() {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const revision = useCounter((s) => s.revision)
  const [draft, setDraft] = useState('')
  const [question, setQuestion] = useState<Question | null>(null)
  const [askedAt, setAskedAt] = useState(0)
  const inputId = useId()
  const text = question ? ('chip' in question ? t(`counter.ask.${question.chip}`) : question.text) : ''

  const answer = useQuery({
    queryKey: ['ask', text, language, revision],
    queryFn: async () => ({ text, revision, response: await api.query({ question: text, language }) }),
    enabled: question !== null,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: 0,
  })

  // The previous answer stays up while a payment refreshes it, but not under a new question.
  const current = answer.data?.text === text ? answer.data : undefined
  const refreshed = current !== undefined && current.revision > askedAt
  const refreshing = current !== undefined && answer.isPlaceholderData

  // Screen readers hear an answer to their own question, not every refresh after a payment.
  const [announcement, setAnnouncement] = useState('')
  const announcedFor = useRef<string | null>(null)
  useEffect(() => {
    if (current && !refreshed && announcedFor.current !== `${current.text}|${language}`) {
      announcedFor.current = `${current.text}|${language}`
      setAnnouncement(current.response.answer)
    }
  }, [current, refreshed, language])

  const ask = (next: Question) => {
    announcedFor.current = null
    setQuestion(next)
    setAskedAt(revision)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const typed = draft.trim()
    if (!typed) return
    ask({ text: typed })
    setDraft('')
  }

  return (
    <ClayCard as="section" aria-labelledby="ask-title" padding="none">
      <header className="flex items-center gap-3 px-5 pt-5 sm:px-6">
        <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
          <MessageCircleQuestion className="size-5" />
        </span>
        <h2 id="ask-title" className="text-lg font-bold">
          {t('counter.ask.title')}
        </h2>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t('counter.ask.label')}
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('counter.ask.placeholder')}
            autoComplete="off"
            enterKeyHint="send"
            className="clay-inset h-12 min-w-0 flex-1 rounded-full px-5 text-[15px] text-ink placeholder:text-slate-soft"
          />
          <ClayButton type="submit" className="shrink-0 px-5" leadingIcon={<SendHorizontal className="size-[18px]" />}>
            {t('counter.ask.send')}
          </ClayButton>
        </form>

        <div role="group" aria-label={t('counter.ask.suggestions')} className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            const selected = question !== null && 'chip' in question && question.chip === chip
            return (
              <button
                key={chip}
                type="button"
                onClick={() => ask({ chip })}
                aria-pressed={selected}
                className={cn(
                  'min-h-12 rounded-full px-4 py-2 text-left text-sm font-medium transition-colors',
                  selected ? 'bg-accent-wash text-ink [box-shadow:inset_0_0_0_1.5px_var(--color-accent)]' : 'bg-well text-ink hover:bg-surface-2',
                )}
              >
                {t(`counter.ask.${chip}`)}
              </button>
            )
          })}
        </div>

        <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
          {question === null ? (
            <p className="text-slate">{t('counter.ask.empty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-slate-soft uppercase">{t('counter.ask.youAsked')}</p>
                <p className="font-semibold text-ink">{text}</p>
              </div>
              {current ? (
                <>
                  <p className="text-[15px] leading-relaxed text-ink">{current.response.answer}</p>
                  {current.response.card && <AnswerVisual card={current.response.card} />}
                  <p className={cn('inline-flex items-center gap-2 text-xs font-medium', refreshed ? 'text-success-ink' : 'text-slate-soft')}>
                    {refreshing ? (
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw aria-hidden className="size-3.5" />
                    )}
                    {refreshed ? t('counter.ask.refreshed') : t('counter.ask.live')}
                  </p>
                </>
              ) : answer.isError ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm font-medium text-danger-ink">
                    {t('counter.ask.error')}
                  </p>
                  <ClayButton variant="secondary" size="sm" onClick={() => void answer.refetch()}>
                    {t('common.tryAgain')}
                  </ClayButton>
                </div>
              ) : (
                <p className="inline-flex items-center gap-2 text-slate">
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  {t('counter.ask.thinking')}
                </p>
              )}
            </div>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </ClayCard>
  )
}

/** The small number card or bar chart that comes with an answer. */
function AnswerVisual({ card }: { card: QueryCard }) {
  if (card.type === 'metric') {
    return (
      <div className="rounded-2xl bg-accent-wash px-4 py-3">
        <p className="text-sm font-medium text-slate">{card.label}</p>
        <p className="text-3xl font-extrabold tracking-tight text-ink tabular-nums">{card.value}</p>
        {card.caption && <p className="text-sm text-slate">{card.caption}</p>}
      </div>
    )
  }
  const max = Math.max(...card.data.map((d) => d.value))
  return (
    <figure className="rounded-2xl bg-well px-4 py-3">
      <figcaption className="text-sm font-medium text-slate">{card.label}</figcaption>
      <ul className="mt-3 flex h-28 items-end gap-2">
        {card.data.map((d) => (
          <li key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="sr-only">
              {d.label}: ₹{d.value.toLocaleString('en-IN')}
            </span>
            <span
              aria-hidden
              className={cn('w-full max-w-8 rounded-t-lg', d.highlight ? 'bg-coral' : 'bg-accent/70')}
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            <span aria-hidden className={cn('text-[11px]', d.highlight ? 'font-bold text-coral-ink' : 'text-slate-soft')}>
              {d.label}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
