import type { LanguageCode } from '../mocks/types'

export type LanguageOption = {
  code: LanguageCode
  /** Name written in the language itself, shown in pickers. */
  nativeName: string
  /** Name in English, shown as a hint under the native name. */
  englishName: string
  /** i18next language code. Hinglish is Hindi written in Latin script. */
  i18nCode: string
  /** Value for <html lang>, so screen readers pick the right voice. */
  htmlLang: string
  /** Preferred Web Speech voices for read-aloud, best first. */
  speechLangs: string[]
  /** A line written in the language itself, shown and read out in the picker. */
  sample: string
  /** The sample as the voice should read it, when that differs (Hinglish is read by a Hindi voice, so it's written in Devanagari). */
  speechSample?: string
}

/** Picker order for a Mumbai kirana: Hinglish first, then Hindi, Marathi, English. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'hinglish', nativeName: 'Hinglish', englishName: 'Hindi in English letters', i18nCode: 'hi-Latn', htmlLang: 'hi-Latn', speechLangs: ['hi-IN', 'en-IN'], sample: 'Namaste! Kal ki sale ₹8,400 thi.', speechSample: 'नमस्ते! कल की सेल ₹8,400 थी।' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', i18nCode: 'hi', htmlLang: 'hi', speechLangs: ['hi-IN'], sample: 'नमस्ते! कल की बिक्री ₹8,400 थी।' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', i18nCode: 'mr', htmlLang: 'mr', speechLangs: ['mr-IN', 'hi-IN'], sample: 'नमस्कार! कालची विक्री ₹8,400 होती.' },
  { code: 'en', nativeName: 'English', englishName: 'English', i18nCode: 'en', htmlLang: 'en-IN', speechLangs: ['en-IN', 'en-GB', 'en-US'], sample: 'Namaste! Yesterday’s sales were ₹8,400.' },
]

export function getLanguage(code: LanguageCode): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}
