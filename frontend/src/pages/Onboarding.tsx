import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Illustration, MerchantPayment, MitraHero } from '../components/illustrations'
import { LanguagePicker } from '../components/language/LanguagePicker'
import { ResetTrustButton, SafetyLimitsPanel, TrustModesPanel, TrustSummary } from '../components/trust'
import { ClayButton, ClayCard, Logo } from '../components/ui'
import { useMerchant, useUpdateTrustSettings } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFocusOnMount } from '../hooks/useFocusOnMount'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { getLanguage } from '../i18n/languages'
import { cn } from '../lib/cn'
import { useOnboardingDraft } from '../store/onboarding'
import { useSession } from '../store/session'

const STEPS = ['language', 'actions', 'limits'] as const
type Step = (typeof STEPS)[number] | 'done'

const STEP_LABEL = {
  language: 'onboarding.stepLanguage',
  actions: 'onboarding.stepActions',
  limits: 'onboarding.stepLimits',
} as const

/**
 * Language → what Mitra may do → safety limits → a short receipt.
 * Every step starts on a safe suggestion, so "Continue" alone gets through.
 * The step lives in ?step= so the phone's back gesture moves between steps.
 */
export function Onboarding() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const raw = params.get('step')
  const step: Step = raw === 'done' || STEPS.includes(raw as (typeof STEPS)[number]) ? (raw as Step) : 'language'
  const index = step === 'done' ? STEPS.length : STEPS.indexOf(step)
  const wide = useMediaQuery('(min-width: 768px)')

  const go = (next: Step) => setParams(next === 'language' ? {} : { step: next })

  if (step === 'done') return <DoneStep onBack={() => go('limits')} />

  return (
    <div className="flex min-h-dvh flex-col bg-well">
      <header className="mx-auto flex w-full max-w-[1160px] items-center justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6">
        <Logo />
        <StepIndicator index={index} />
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-[1160px] flex-1 gap-8 px-4 pt-6 pb-32 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:px-8 md:pb-12 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14"
      >
        {/* Only rendered on wide screens, so phones don't download the art. */}
        {wide && (
          <aside aria-hidden>
            <div className="sticky top-8">
              <StepScene step={step} />
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-col gap-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
              exit={reduce ? undefined : { opacity: 0, x: -16, transition: { duration: 0.16 } }}
              className="flex flex-col gap-6"
            >
              <StepHeading step={step} />
              <StepBody step={step} />
            </motion.div>
          </AnimatePresence>

          {/* Sticky in the thumb zone on phones, inline on wider screens. */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-line/70 bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0">
            {index > 0 && (
              <ClayButton variant="secondary" size="lg" onClick={() => go(STEPS[index - 1])} leadingIcon={<ArrowLeft className="size-5" />}>
                {/* Icon only on the narrowest phones, so Continue never gets clipped. */}
                <span className="max-[400px]:sr-only">{t('onboarding.back')}</span>
              </ClayButton>
            )}
            <ClayButton
              size="lg"
              className="min-w-0 flex-1 md:flex-none"
              onClick={() => go(index + 1 < STEPS.length ? STEPS[index + 1] : 'done')}
              trailingIcon={<ArrowRight className="size-5" />}
            >
              {t('onboarding.next')}
            </ClayButton>
          </div>
        </div>
      </main>
    </div>
  )
}

function StepIndicator({ index }: { index: number }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('onboarding.stepOf', { current: index + 1, total: STEPS.length })} className="flex flex-col items-end gap-1.5">
      <p className="text-sm font-semibold text-ink">
        {t('onboarding.stepOf', { current: index + 1, total: STEPS.length })}
        <span className="hidden text-slate sm:inline"> · {t(STEP_LABEL[STEPS[index]])}</span>
      </p>
      <ol className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === index ? 'step' : undefined}
            className={cn('h-2 rounded-full transition-all duration-300', i === index ? 'w-10 bg-accent' : i < index ? 'w-6 bg-accent/45' : 'w-6 bg-line')}
          >
            <span className="sr-only">
              {t(STEP_LABEL[s])}
              {i < index && ' ✓'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StepHeading({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useTranslation()
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const copy = {
    language: ['onboarding.languageTitle', 'onboarding.languageSubtitle'],
    actions: ['onboarding.actionsTitle', 'onboarding.actionsSubtitle'],
    limits: ['onboarding.limitsTitle', 'onboarding.limitsSubtitle'],
  } as const
  const [title, subtitle] = copy[step]
  useDocumentTitle(t(title))
  return (
    <div className="flex items-start gap-3">
      <Illustration name="mitra-avatar" className="size-12 shrink-0 rounded-full bg-accent-wash [box-shadow:var(--clay-shadow-soft)] md:hidden" />
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-tight font-bold tracking-[-0.02em] outline-none md:text-[34px]">
          {t(title)}
        </h1>
        <p className="mt-1.5 text-slate md:text-body-lg">{t(subtitle)}</p>
      </div>
    </div>
  )
}

function StepBody({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const setLanguage = useSession((s) => s.setLanguage)
  const trust = useOnboardingDraft((s) => s.trust)
  const setTrust = useOnboardingDraft((s) => s.setTrust)

  if (step === 'language') {
    return <LanguagePicker value={language} onChange={setLanguage} legend={t('onboarding.languageTitle')} />
  }
  return (
    <div className="flex flex-col gap-4">
      {step === 'actions' ? <TrustModesPanel value={trust} onChange={setTrust} /> : <SafetyLimitsPanel value={trust} onChange={setTrust} />}
      <ResetTrustButton value={trust} scope={step === 'actions' ? 'modes' : 'limits'} onChange={setTrust} />
    </div>
  )
}

/** The picture beside each step on wide screens. */
function StepScene({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const option = getLanguage(language)

  if (step === 'language') {
    return (
      // Bubble above and to the right, so it points at Mitra without covering his face.
      <div className="flex flex-col items-center gap-2">
        <div className="max-w-[250px] self-end rounded-3xl rounded-bl-md bg-surface px-4 py-3 [box-shadow:var(--clay-shadow-soft)] lg:mr-[4%]">
          <p className="text-xs font-semibold text-slate-soft">{t('onboarding.greetingPreview')}</p>
          <p lang={option.htmlLang} className="mt-1 font-semibold text-ink">
            {option.sample}
          </p>
        </div>
        <MitraHero className="h-[min(50vh,400px)]" />
      </div>
    )
  }
  return <MerchantPayment className="mx-auto h-[min(60vh,500px)]" />
}

function DoneStep({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  useDocumentTitle(t('onboarding.doneTitleNoName'))
  const errorRef = useRef<HTMLParagraphElement>(null)
  const resetDraft = useOnboardingDraft((s) => s.reset)
  const navigate = useNavigate()
  const trust = useOnboardingDraft((s) => s.trust)
  const completeOnboarding = useSession((s) => s.completeOnboarding)
  const { data: merchant } = useMerchant()
  const save = useUpdateTrustSettings()

  const start = () => {
    // aria-disabled rather than disabled while saving, so focus stays on the button.
    if (save.isPending) return
    save.mutate(trust, {
      onSuccess: () => {
        completeOnboarding()
        resetDraft()
        navigate('/', { replace: true })
      },
      onError: () => requestAnimationFrame(() => errorRef.current?.focus()),
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-well">
      <header className="mx-auto flex w-full max-w-[1160px] items-center justify-between px-4 pt-4 md:px-8 md:pt-6">
        <Logo />
      </header>
      <main id="main" className="mx-auto grid w-full max-w-[1000px] flex-1 content-center items-center gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:gap-12 md:px-8">
        <div className="relative mx-auto">
          <Illustration name="mitra-celebrate" hero alt="" className="w-[220px] md:w-[380px]" />
        </div>
        <ClayCard padding="lg" className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-wash text-success-ink">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <div>
              <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-tight font-bold tracking-[-0.02em] outline-none md:text-[30px]">
                {merchant ? t('onboarding.doneTitle', { name: merchant.name }) : t('onboarding.doneTitleNoName')}
              </h1>
              <p className="mt-1 text-slate">{t('onboarding.doneSubtitle')}</p>
            </div>
          </div>
          <TrustSummary value={trust} />
          {save.isError && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm font-medium text-danger-ink outline-none">
              {t('onboarding.saveError')}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <ClayButton size="lg" fullWidth onClick={start} aria-disabled={save.isPending || undefined} aria-busy={save.isPending || undefined} trailingIcon={<ArrowRight className="size-5" />}>
              {save.isPending ? t('onboarding.saving') : t('onboarding.start')}
            </ClayButton>
            <ClayButton variant="ghost" onClick={onBack} leadingIcon={<ArrowLeft className="size-5" />}>
              {t('onboarding.back')}
            </ClayButton>
          </div>
          <p className="text-center text-sm text-slate-soft">{t('onboarding.changeLater')}</p>
        </ClayCard>
      </main>
    </div>
  )
}
