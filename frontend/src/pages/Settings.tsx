import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ComingNext } from '../components/layout/ComingNext'
import { PageHeader } from '../components/layout/PageHeader'
import { LanguagePicker } from '../components/language/LanguagePicker'
import { ConnectedTrustSettings } from '../components/trust'
import { ClayButton } from '../components/ui'
import { useTrustAutosave } from '../hooks/useTrustAutosave'
import { useSession } from '../store/session'

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-[22px] font-bold tracking-[-0.015em]">
          {title}
        </h2>
        {subtitle && <p className="text-slate">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

export function Settings() {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const setLanguage = useSession((s) => s.setLanguage)
  const phone = useSession((s) => s.phone)
  const signOut = useSession((s) => s.signOut)
  const trust = useTrustAutosave()

  return (
    <>
      <PageHeader title={t('pages.settings.title')} subtitle={t('pages.settings.subtitle')} />
      <div className="flex flex-col gap-10">
        <Section id="settings-language" title={t('pages.settings.language')}>
          <LanguagePicker value={language} onChange={setLanguage} legend={t('pages.settings.language')} />
        </Section>
        <Section id="settings-trust" title={t('pages.settings.trust')} subtitle={t('pages.settings.trustSubtitle')}>
          <ConnectedTrustSettings trust={trust} section="modes" />
        </Section>
        <Section id="settings-limits" title={t('pages.settings.limits')}>
          <ConnectedTrustSettings trust={trust} section="limits" />
          <p role="status" className="sr-only">
            {trust.statusText}
          </p>
        </Section>
        <ComingNext phase={9} items={[t('pages.settings.next1'), t('pages.settings.next2')]} />
        <Section id="settings-account" title={t('pages.settings.account')}>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-clay bg-surface p-5 [box-shadow:var(--clay-shadow-soft)]">
            {phone && <p className="font-medium text-ink">{t('pages.settings.signedInAs', { phone: `+91 ${phone.slice(0, 2)}******${phone.slice(-2)}` })}</p>}
            <ClayButton variant="secondary" onClick={signOut} leadingIcon={<LogOut className="size-4" />}>
              {t('pages.settings.signOut')}
            </ClayButton>
          </div>
        </Section>
      </div>
    </>
  )
}
