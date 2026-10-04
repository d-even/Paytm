// npm run n8n:check — sends a "ping" to your n8n workflow and prints exactly what comes back.
const n8n = require('../src/integrations/n8n');
const config = require('../src/config');
(async () => {
  if (!n8n.enabled()) { console.log('N8N_WEBHOOK_URL is empty in .env — n8n is off (built-in channels are used).'); return; }
  console.log('→', config.n8n.webhookUrl, config.n8n.sharedSecret ? '(with secret)' : '(NO secret set — add N8N_SHARED_SECRET)');
  try {
    console.log('←', JSON.stringify(await n8n.run({ event: 'agent.action', route: 'ping', sentAt: new Date().toISOString() })));
    console.log('\n✅ n8n answered. The workflow is reachable and the secret matches.');
  } catch (err) {
    console.log(`\n❌ ${err.message}`);
    console.log('   404 → workflow not Active (use the Production URL, not /webhook-test/) · 403 → secret differs from the Header Auth credential');
    process.exitCode = 1;
  }
})();
