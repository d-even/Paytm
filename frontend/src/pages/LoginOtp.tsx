import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { ClayButton, ClayCard, OtpInput } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useNow } from '../hooks/useNow'
import { api, ApiError } from '../lib/api'
import { useSession, type PendingOtp } from '../store/session'

/** Step 2 of sign-in. Submits by itself once all six digits are in. */
export function LoginOtp({ pending }: { pending: PendingOtp }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signIn = useSession((s) => s.signIn)
  const startOtp = useSession((s) => s.startOtp)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  useDocumentTitle(t('auth.otpTitle'))
  const hintId = useId()

  const resendAt = pending.sentAt + pending.resendAfterSeconds * 1000
  const now = useNow()
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000))

  const verify = useMutation({ mutationFn: api.verifyOtp })
  const verifying = useRef(false)
  const resend = useMutation({
    mutationFn: api.sendOtp,
    onSuccess: (res) => {
      startOtp({ ...pending, phoneMasked: res.phoneMasked, sentAt: Date.now(), resendAfterSeconds: res.resendAfterSeconds })
      setNotice(t('auth.resent'))
      setError(null)
      setOtp('')
      inputRef.current?.focus()
    },
    onError: () => setError(t('auth.networkError')),
  })

  const submit = (code: string) => {
    // A ref, not isPending: autofill and a tap can both land in the same tick.
    if (verifying.current) return
    if (code.length !== 6) {
      setError(t('auth.otpIncomplete'))
      inputRef.current?.focus()
      return
    }
    setError(null)
    verifying.current = true
    // Callbacks passed here don't run if the merchant has already left (e.g. tapped "Change number").
    verify.mutate(
      { phone: pending.phone, otp: code },
      {
        onSuccess: (res) => {
          signIn(pending.phone, res.token)
          navigate('/', { replace: true })
        },
        onError: (e) => {
          setError(
            e instanceof ApiError && e.status === 401
              ? t('auth.otpWrong')
              : e instanceof ApiError && e.status === 422
                ? t('auth.otpIncomplete')
                : t('auth.networkError'),
          )
          setOtp('')
          inputRef.current?.focus()
        },
        onSettled: () => {
          verifying.current = false
        },
      },
    )
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(otp)
  }

  return (
    <AuthLayout bubble={t('auth.mitraOtp')}>
      <ClayCard padding="lg" className="flex flex-col gap-6">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] md:text-[30px]">{t('auth.otpTitle')}</h1>
          <p className="mt-1.5 text-slate">
            {t('auth.otpSentTo', { phone: pending.phoneMasked })}{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              disabled={verify.isPending}
              className="inline-flex min-h-12 items-center gap-1 font-semibold text-accent-ink underline-offset-4 hover:underline disabled:opacity-50"
            >
              <ArrowLeft aria-hidden className="size-4" />
              {t('auth.changeNumber')}
            </button>
          </p>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <OtpInput
            ref={inputRef}
            value={otp}
            onChange={(v) => {
              setOtp(v)
              if (error) setError(null)
              if (notice) setNotice(null)
              // Submit on the sixth digit, the way SMS autofill users expect.
              if (v.length === 6 && otp.length < 6 && !verify.isPending) submit(v)
            }}
            label={t('auth.otpLabel')}
            invalid={!!error}
            describedBy={error ? `${errorId} ${hintId}` : hintId}
            busy={verify.isPending}
            autoFocus
          />
          {error && (
            <p id={errorId} role="alert" className="text-sm font-medium text-danger-ink">
              {error}
            </p>
          )}
          <p id={hintId} className="text-sm text-slate-soft">
            {t('auth.demoHint')}
          </p>
          <ClayButton
            type="submit"
            size="lg"
            fullWidth
            aria-busy={verify.isPending || undefined}
            disabled={verify.isPending}
            trailingIcon={<ArrowRight className="size-5" />}
          >
            {verify.isPending ? t('auth.verifying') : t('auth.verify')}
          </ClayButton>
        </form>
        <div className="flex min-h-12 items-center justify-center text-sm">
          {secondsLeft > 0 ? (
            <p className="text-center text-slate tabular-nums">{t('auth.resendIn', { seconds: secondsLeft })}</p>
          ) : (
            <ClayButton variant="ghost" size="sm" onClick={() => resend.mutate({ phone: pending.phone })} disabled={resend.isPending}>
              {t('auth.resend')}
            </ClayButton>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {notice}
        </p>
        {notice && (
          <p aria-hidden className="-mt-4 text-center text-sm font-medium text-success-ink">
            {notice}
          </p>
        )}
      </ClayCard>
    </AuthLayout>
  )
}
