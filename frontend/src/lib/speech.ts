import { useCallback, useEffect, useState } from 'react'
import { getLanguage } from '../i18n/languages'
import type { LanguageCode } from '../mocks/types'

/**
 * Read-aloud with the Web Speech API. Each app language maps to a list of
 * preferred voices (see i18n/languages.ts); the first one the device has wins,
 * otherwise the browser picks its default voice for the first language tag.
 */

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function pickVoice(code: LanguageCode) {
  const wanted = getLanguage(code).speechLangs.map((l) => l.toLowerCase())
  const voices = window.speechSynthesis.getVoices()
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-')
  // Every exact match (mr-IN, then hi-IN) beats any looser one (mr-*, hi-*).
  for (const want of wanted) {
    const exact = voices.find((v) => lang(v) === want)
    if (exact) return exact
  }
  for (const want of wanted) {
    const loose = voices.find((v) => lang(v).startsWith(`${want.slice(0, 2)}-`))
    if (loose) return loose
  }
  return undefined
}

export function useSpeech() {
  const supported = speechSupported()
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    // Chrome loads voices lazily: asking once now means they're ready by the first tap.
    window.speechSynthesis.getVoices()
    return () => window.speechSynthesis.cancel()
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [supported])

  /** Speaks `text`; `id` lets the caller show which button is playing. */
  const speak = useCallback(
    (text: string, code: LanguageCode, id = 'default') => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const voice = pickVoice(code)
      utterance.lang = voice?.lang ?? getLanguage(code).speechLangs[0]
      if (voice) utterance.voice = voice
      utterance.rate = 0.95
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current))
      utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current))
      setSpeakingId(id)
      window.speechSynthesis.speak(utterance)
    },
    [supported],
  )

  return { supported, speakingId, speak, stop }
}
