import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { useSession } from '../store/session'
import { getLanguage } from './languages'
import { en } from './locales/en'
import { hi } from './locales/hi'
import { hinglish } from './locales/hinglish'
import { mr } from './locales/mr'

/**
 * UI language. The merchant's choice lives in the persisted session store;
 * this module mirrors it into i18next and <html lang> whenever it changes.
 */

function applyLanguage(code: Parameters<typeof getLanguage>[0]) {
  const language = getLanguage(code)
  if (i18n.language !== language.i18nCode) void i18n.changeLanguage(language.i18nCode)
  document.documentElement.lang = language.htmlLang
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'hi-Latn': { translation: hinglish },
    hi: { translation: hi },
    mr: { translation: mr },
  },
  lng: getLanguage(useSession.getState().language).i18nCode,
  // Every locale is complete (enforced by types), so fallbacks only guard against typos.
  fallbackLng: { mr: ['hi', 'en'], default: ['en'] },
  supportedLngs: ['hi-Latn', 'en', 'hi', 'mr'],
  // Without this, Hinglish ('hi-Latn') would fall back to Devanagari Hindi
  // for any missing key before reaching English.
  load: 'currentOnly',
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false,
  returnNull: false,
})

applyLanguage(useSession.getState().language)
useSession.subscribe((state, previous) => {
  if (state.language !== previous.language) applyLanguage(state.language)
})

export default i18n
