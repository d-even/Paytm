// npm run sarvam:check — asks Sarvam to speak one line and prints exactly what happens (and saves sarvam-test.wav).
const fs = require('fs');
const sarvam = require('../src/integrations/sarvam');
const config = require('../src/config');
(async () => {
  if (!sarvam.enabled()) { console.log('SARVAM_API_KEY is empty in .env — Sarvam is off (the browser voice is used).'); return; }
  const lang = process.argv[2] || 'hi-IN';
  const text = process.argv[3] || 'Namaste Deven ji, aaj Mangalwar ko sale thodi kam rehti hai. Chhota offer bhejein?';
  console.log(`→ ${config.sarvam.baseUrl}  model ${config.sarvam.ttsModel}  speaker ${config.sarvam.speaker}  lang ${lang}`);
  const v = await sarvam.voice(text, lang);
  if (!v) { console.log('\n❌ No audio. The reason is logged above (wrong key? unknown speaker? set SARVAM_SPEAKER in .env).'); process.exitCode = 1; return; }
  fs.writeFileSync('sarvam-test.wav', Buffer.from(v.audio, 'base64'));
  console.log(`\n✅ Spoken text: "${v.text}"\n   Saved sarvam-test.wav (${Math.round(v.audio.length * 0.75 / 1024)} KB) — open it to listen.`);
})();
