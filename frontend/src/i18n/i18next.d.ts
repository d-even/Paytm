import 'i18next'
import type { en } from './locales/en'

// Typed translation keys: t('nav.home') is checked against the English source.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
    returnNull: false
  }
}
