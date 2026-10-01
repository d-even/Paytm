import { useMutation } from '@tanstack/react-query'
import { ArrowRight, ShieldCheck, Smartphone } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useNavigationType } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { ClayButton, ClayCard } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFocusOnMount } from '../hooks/useFocusOnMount'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/cn'
import { useSession } from '../store/session'

const INDIAN_MOBILE = /^[6-9]\d{9}$/

/** Keeps the last 10 digits of whatever was typed or pasted (+91, 0 or spaces are dropped). */
function cleanPhone(raw: string) {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

/** Step 1 of sign-in: the merchant's Paytm mobile number. */
export function Login() {
  const { t } = useTranslation()
  // After sign-out or "Change number", start at the title (not on first load).
  const headingRef = useFocusOnMount<HTMLHeadingElement>(useNavigationType() !== 'POP')
  useDocumentTitle(t('auth.phoneTitle'))
  const navigate = useNavigate()
  const startOtp = useSession((s) => s.startOtp)
  const pending = useSession((s) => s.pendingOtp)
  const [phone, setPhone] = useState(pending?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const inputId = useId()

  const send = useMutation({
    mutationFn: api.sendOtp,
    onSuccess: (res, vars) => {
      startOtp({ phone: vars.phone, phoneMasked: res.phoneMasked, sentAt: Date.now(), resendAfterSeconds: res.resendAfterSeconds })
      navigate('/login/otp')
    },
    onError: (e) => {
      setError(e instanceof ApiError && e.status === 422 ? t('auth.phoneInvalid') : t('auth.networkError'))
      inputRef.current?.focus()
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!INDIAN_MOBILE.test(phone)) {
      setError(t('auth.phoneInvalid'))
      inputRef.current?.focus()
      return
    }
    setError(null)
    send.mutate({ phone })
  }

  return (
    <AuthLayout bubble={t('auth.mitraHello')}>
      <ClayCard padding="lg" className="flex flex-col gap-6">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-tight font-bold tracking-[-0.02em] outline-none md:text-[30px]">
            {t('auth.phoneTitle')}
          </h1>
          <p className="mt-1.5 text-slate">{t('auth.phoneSubtitle')}</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-semibold text-ink">
              {t('auth.phoneLabel')}
            </label>
            <div
              className={cn(
                'clay-inset flex h-16 items-center gap-3 rounded-2xl px-4',
                'focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent',
                error && 'ring-2 ring-danger',
              )}
            >
              <Smartphone aria-hidden className="size-5 shrink-0 text-slate-soft" />
              <span className="text-lg font-semibold text-ink" aria-hidden>
                +91
              </span>
              <input
                ref={inputRef}
                id={inputId}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                enterKeyHint="go"
                value={phone}
                onChange={(e) => {
                  setPhone(cleanPhone(e.target.value))
                  if (error) setError(null)
                }}
                placeholder="98765 43210"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="h-full min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-wide text-ink tabular-nums outline-none placeholder:font-medium placeholder:text-slate-soft"
              />
            </div>
            {error && (
              <p id={errorId} role="alert" className="text-sm font-medium text-danger-ink">
                {error}
              </p>
            )}
          </div>
          <ClayButton
            type="submit"
            size="lg"
            fullWidth
            aria-busy={send.isPending || undefined}
            disabled={send.isPending}
            trailingIcon={<ArrowRight className="size-5" />}
          >
            {send.isPending ? t('auth.sending') : t('auth.sendOtp')}
          </ClayButton>
        </form>
        <p className="flex items-center gap-2 text-sm text-slate-soft">
          <ShieldCheck aria-hidden className="size-4 shrink-0 text-success-ink" />
          {t('auth.privacy')}
        </p>
      </ClayCard>
    </AuthLayout>
  )
}
