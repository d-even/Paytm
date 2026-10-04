// Sarvam AI = the voice and language layer. The agent's Soundbox lines are turned into natural Indian-language
// speech (Bulbul), and translated first (Mayura) when the shop's language is not Hindi or English.
//
// Never required: with no SARVAM_API_KEY, or on any error, voice() returns null and the browser's own voice reads the
// line exactly as before. A Sarvam problem must never stop the agent from talking.
const config = require('../config');
const { postJson } = require('../channels/http');
const log = require('../utils/logger');

const enabled = () => Boolean(config.sarvam.apiKey);
const SUPPORTED = new Set(['hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'gu-IN', 'pa-IN', 'od-IN', 'en-IN']);
const MAX_AUDIO_B64 = 700_000; // keep the live-feed message small

// 'hi-IN' / 'mr-IN' as is, any English → en-IN, anything unknown → Hindi.
function languageCode(lang) {
  const l = String(lang || '').trim();
  if (/^en/i.test(l)) return 'en-IN';
  const match = [...SUPPORTED].find((c) => c.toLowerCase() === l.toLowerCase());
  return match || 'hi-IN';
}

const headers = () => ({ 'api-subscription-key': config.sarvam.apiKey });
const url = (path) => `${config.sarvam.baseUrl}${path}`;

async function translate(text, target) {
  const res = await postJson(url('/translate'), {
    input: text, source_language_code: 'auto', target_language_code: target, model: config.sarvam.translateModel, mode: 'modern-colloquial',
  }, headers(), config.sarvam.timeoutMs);
  if (!res || typeof res.translated_text !== 'string' || !res.translated_text.trim()) throw new Error('translate: no translated_text in the response');
  return res.translated_text.trim();
}

async function tts(text, target) {
  const body = { text, target_language_code: target, speaker: config.sarvam.speaker, model: config.sarvam.ttsModel };
  let res;
  try {
    res = await postJson(url('/text-to-speech'), body, headers(), config.sarvam.timeoutMs);
  } catch (err) {
    // The language field has been named both ways across API versions: retry once with the other name on a validation error.
    if (err.message !== 'HTTP 422') throw err;
    const { target_language_code, ...rest } = body;
    res = await postJson(url('/text-to-speech'), { ...rest, language_code: target_language_code }, headers(), config.sarvam.timeoutMs);
  }
  const audio = Array.isArray(res?.audios) ? res.audios[0] : null;
  if (typeof audio !== 'string' || !audio) throw new Error('tts: no audio in the response');
  return audio;
}

const cache = new Map(); // text|lang → result, so repeated lines are not paid for twice
const CACHE_MAX = 50;

/**
 * @returns {Promise<{text: string, lang: string, audio: string, mime: string} | null>}
 *   `text` is what is actually spoken (translated when needed), `audio` is base64 WAV.
 */
async function voice(text, lang) {
  if (!enabled() || !text) return null;
  const target = languageCode(lang);
  const key = `${target}|${text}`;
  if (cache.has(key)) return cache.get(key);
  try {
    // Hindi and English go straight to Bulbul (it handles Hinglish); other languages are translated first.
    const spoken = target === 'hi-IN' || target === 'en-IN' ? text : await translate(text, target);
    const audio = await tts(spoken.slice(0, 2400), target);
    if (audio.length > MAX_AUDIO_B64) { log.warn('sarvam', `audio too large for the live feed (${audio.length} chars), using the browser voice`); return null; }
    const out = { text: spoken, lang: target, audio, mime: 'audio/wav' };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  } catch (err) {
    const detail = err.response?.message || err.response?.error?.message || (typeof err.response === 'string' ? err.response.slice(0, 160) : '');
    log.warn('sarvam', `${err.message}${detail ? ` — ${detail}` : ''}; using the browser voice`);
    return null;
  }
}

module.exports = { enabled, languageCode, translate, tts, voice, _cache: cache };
