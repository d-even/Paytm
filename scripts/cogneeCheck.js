// npm run cognee:check — stores one fact in the memory service, waits for the graph, and asks a question.
const memory = require('../src/integrations/cognee');
const config = require('../src/config');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (!memory.enabled()) { console.log('COGNEE_URL is empty in .env — memory is MongoDB only.'); return; }
  console.log('→', config.cognee.url);
  memory.remember('MID-CHECK', 'Chinu paid ₹240 by a card tap at Check Store on Tuesday 2026-09-29 in the evening, buying milk.');
  const stored = await memory.flush('MID-CHECK');
  if (!stored) { console.log('\n❌ Could not store the fact (is the service running? see the warning above).'); process.exitCode = 1; return; }
  console.log('✅ fact stored. Cognee is building the graph (this calls your LLM, give it up to a minute)…');
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const answer = await memory.recall('MID-CHECK', 'What does Chinu usually buy and on which day?');
    if (answer) { console.log(`\n✅ Memory answered: ${answer}`); return; }
    process.stdout.write('.');
  }
  console.log('\n⚠️ No answer yet. Check the service log: most often LLM_API_KEY is missing or wrong.');
  process.exitCode = 1;
})();
