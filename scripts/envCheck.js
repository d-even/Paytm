require('dotenv').config();
for (const k of ['ANTHROPIC_API_KEY', 'SARVAM_API_KEY']) {
  const v = (process.env[k] || '').trim();
  console.log(k, v ? `set, ${v.length} characters` : 'EMPTY');
}
console.log('folder:', process.cwd());