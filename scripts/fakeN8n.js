// A stand-in for the n8n workflow, so you can test the whole hand-off on your laptop without n8n:
//   1) npm run n8n:fake                        (listens on http://localhost:5679/webhook/vyapaar-mitra)
//   2) .env →  N8N_WEBHOOK_URL=http://localhost:5679/webhook/vyapaar-mitra
//              N8N_SHARED_SECRET=any-long-secret
//   3) npm start, then press "Run agent now" in the app.
// It checks the secret like the real Webhook node does, "sends" nothing, and answers in the same shape as the workflow.
require('dotenv').config({ quiet: true });
const http = require('http');
const PORT = Number(process.env.FAKE_N8N_PORT) || 5679;
const secret = (process.env.N8N_SHARED_SECRET || '').trim();

http.createServer((req, res) => {
  const reply = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST' || req.url !== '/webhook/vyapaar-mitra') return reply(404, { error: 'POST /webhook/vyapaar-mitra' });
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (secret && req.headers['x-vm-secret'] !== secret) return reply(403, { message: 'Authorization data is wrong!' });
    let b; try { b = JSON.parse(raw); } catch { return reply(400, { error: 'bad json' }); }
    const executionId = `fake-${Date.now()}`;
    if (b.route === 'ping') return reply(200, { ok: true, pong: true, executionId });
    if (b.route === 'whatsapp') {
      const results = (b.recipients || []).map((r) => ({ phone: r.phone, status: 'sent' }));
      console.log(`[fake n8n] whatsapp · ${b.kind} · trust ${b.trust?.riskTier}/${b.trust?.decidedBy} · ${results.length} recipients\n           "${b.message}"`);
      return reply(200, { ok: true, sent: results.length, failed: 0, results, executionId });
    }
    console.log(`[fake n8n] ${b.route} · ${b.kind}`);
    reply(200, { ok: true, route: b.route, note: `fake n8n handled ${b.kind}`, executionId });
  });
}).listen(PORT, () => console.log(`[fake n8n] up on http://localhost:${PORT}/webhook/vyapaar-mitra`));
