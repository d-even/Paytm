import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getLanguage } from '../../i18n/languages'
import { useSpeech } from '../../lib/speech'
import { useCounter } from '../../store/counter'
import { useSession } from '../../store/session'
import { lineText } from './lines'

/** Captions older than this (e.g. restored after a reload) are shown but not read out. */
const FRESH_MS = 5_000

/**
 * The Soundbox's voice. Lives in the app shell, so a caption is read out
 * wherever the merchant is. Hinglish is read by a Hindi voice, so it gets the
 * Devanagari Hindi line rather than Latin letters.
 */
export function SoundboxVoice() {
  const { i18n } = useTranslation()
  const caption = useCounter((s) => s.caption)
  const voiceOn = useCounter((s) => s.voiceOn)
  const language = useSession((s) => s.language)
  const { supported, speak, stop, speakingId } = useSpeech()
  const spoken = useRef<number | null>(null)

  useEffect(() => {
    if (!caption || !caption.speak || !voiceOn || !supported || spoken.current === caption.id) return
    spoken.current = caption.id
    if (Date.now() - caption.at > FRESH_MS) return
    const speechT = i18n.getFixedT(language === 'hinglish' ? 'hi' : getLanguage(language).i18nCode)
    speak(lineText(speechT, caption.line), language, 'soundbox')
  }, [caption, voiceOn, supported, language, speak, i18n])

  useEffect(() => {
    if (!voiceOn) stop()
  }, [voiceOn, stop])

  useEffect(() => {
    useCounter.setState({ speaking: speakingId === 'soundbox' })
  }, [speakingId])

  return null
}
