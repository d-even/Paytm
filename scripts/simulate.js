// npm run simulate — the full architecture, end to end, in one command.
//
//   Customer ─► POS/QR ─► Payment gateway ─► Merchant account
//                                 └──► Agent core: Observe → Reason → Decide → Act → Learn
//                                                              └──► Soundbox · WhatsApp · Dashboard
//
// It re-seeds the demo merchant, boots the API in-process on a free port, and then
// drives it over real HTTP exactly like the Paytm App / Soundbox cloud / ESP32 would —
// including HMAC-signed POS requests. Needs only MongoDB (MONGODB_URI).
const crypto = require('crypto');
const config = require('../src/config');
const { connectDB, disconnectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const { attachEventHandlers } = require('../src/agent');
const { learn } = require('../src/agent/learn');
const { Transaction, AgentAction, Merchant } = require('../src/models');
const { hashIdentity, maskVpa } = require('../src/utils/crypto');
const { localParts } = require('../src/utils/time');
const { seed } = require('./seed');

const MID = 'MID-RAMESH-001';
const DEVICE = 'POS-RAMESH-01';
let BASE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
function step(n, title, layer) {
  console.log(`\n${bold(`━━ STEP ${n} · ${title}`)}  \x1b[90m(${layer})\x1b[0m`);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// Signs the request exactly like hardware/esp32_rfid_pos does.
async function posTap(rfidUid, amount) {
  const body = JSON.stringify({ merchantId: MID, amount, rfidUid });
  const ts = Math.floor(Date.now() / 1000);
  const secret = config.pos.deviceSecrets.get(DEVICE);
  const sig = crypto.createHmac('sha256', secret).update(`${DEVICE}.${ts}.${body}`).digest('hex');
  const res = await fetch(`${BASE}/api/v1/pos/tap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-timestamp': String(ts), 'x-signature': sig },
    body,
  });
  return res.json();
}

async function main() {
  // Demo-safe defaults so `npm run simulate` works even before .env is filled in.
  if (!config.apiKey) config.apiKey = 'simulate-local-key';
  if (!config.pos.deviceSecrets.has(DEVICE) || config.pos.deviceSecrets.get(DEVICE).startsWith('replace')) {
    config.pos.deviceSecrets.set(DEVICE, crypto.randomBytes(32).toString('hex'));
  }

  await connectDB();
  const data = await seed();
  console.log(`Seeded ${data.merchant.name}: ${data.transactions.length} transactions, ${data.profiles.length} customers (28 days).`);
  console.log(`Reasoning engine: ${config.llm.enabled ? `Claude (${config.llm.model})` : 'rule-based fallback (set ANTHROPIC_API_KEY to use Claude)'}`);

  attachEventHandlers();
  const server = createApp().listen(0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  step(1, 'A customer pays by UPI', 'Data layer → Payment gateway');
  const upi = await api('POST', '/api/v1/payments/upi', {
    merchantId: MID, amount: 186, payerVpa: 'regular7@paytm',
    items: [{ name: 'Chai patti 250g', qty: 1, price: 120 }, { name: 'Doodh 500ml', qty: 2, price: 33 }],
  });
  console.log('   →', upi);

  step(2, 'Morning briefing on the Soundbox', 'Agent → Channel: Soundbox');
  const brief = await api('POST', '/api/v1/agent/briefing', { merchantId: MID });
  console.log('   🔊', brief.spoken);

  step(3, 'Agent cycle: Observe → Reason → Decide → Act → Learn', 'Agent core');
  const cycle = await api('POST', '/api/v1/agent/run', { merchantId: MID });
  console.log(`   ${cycle.insightsCreated} insights · reasoning by ${cycle.usedLLM ? 'Claude' : 'rules'}`);
  cycle.actions.forEach((a) => console.log(`   • ${a.kind.padEnd(16)} ${a.mode ? a.mode.padEnd(10) : ''} → ${a.status}`));

  step(4, 'What the merchant sees in the app', 'Action layer: GET /agent/insights');
  const { insights, pendingApprovals } = await api('GET', `/api/v1/agent/insights?merchantId=${MID}&status=all`);
  insights.forEach((i) => console.log(`   💡 [${i.type}] ${i.summary}`));
  pendingApprovals.forEach((p) => console.log(`   ⏳ needs approval: ${p.kind} — ${p.message}  (${p.whyNotAuto})`));

  step(5, 'Merchant approves the loan offer, rejects the restock tip', 'Action layer: POST /agent/action/approve');
  for (const p of pendingApprovals) {
    const decision = p.kind === 'CREDIT_OFFER' ? 'approve' : 'reject';
    const r = await api('POST', '/api/v1/agent/action/approve', { merchantId: MID, actionId: p.actionId, decision });
    console.log(`   ${decision === 'approve' ? '✅' : '❌'} ${r.kind} → ${r.status}`);
  }

  step(6, 'Sharma ji taps his card at the counter', 'Complementary signal: POS/RFID → real-time');
  console.log('   ESP32 LCD ←', await posTap(data.cards.SHARMA.rfidUid, 240));
  await sleep(300);

  step(7, 'Gupta ji — a lapsed regular — walks back in', 'Complementary signal: POS/RFID → real-time');
  console.log('   ESP32 LCD ←', await posTap(data.cards.GUPTA.rfidUid, 310));
  await sleep(300);

  step(8, 'Merchant asks the copilot', 'Action layer: POST /agent/query');
  for (const q of ['Aaj ki sale kitni hui?', 'Is hafte sabse zyada kya bika?', 'Kya mujhe loan mil sakta hai?']) {
    const a = await api('POST', '/api/v1/agent/query', { merchantId: MID, question: q });
    console.log(`   🗣  ${q}\n   🤖 ${a.answer}`);
  }

  step(9, '⏩ Fast-forward one week and let the agent learn', 'Agent core: Learn');
  // Demo time-travel: write the sales that "happened" after the offer, then evaluate.
  const offer = await AgentAction.findOne({ merchantId: MID, kind: 'WHATSAPP_OFFER', status: 'executed' });
  if (offer) {
    const target = offer.payload.targetDate;
    const targetStart = new Date(`${target}T09:00:00+05:30`);
    const already = (await Transaction.aggregate([
      { $match: { merchantId: MID, settledAt: { $gte: new Date(`${target}T00:00:00+05:30`), $lt: new Date(`${target}T23:59:59+05:30`) } } },
      { $group: { _id: null, t: { $sum: '$amount' } } },
    ]))[0]?.t || 0;
    const extra = [];
    let total = already; let i = 0;
    while (total < 10900) {
      const amount = Math.min(180 + (i % 5) * 20, 10900 - total);
      extra.push({ txnId: `FF${Date.now()}${i}`, merchantId: MID, amount, channel: 'UPI', source: 'upi', status: 'SETTLED',
        customerKey: hashIdentity('upi', `regular${(i % 39) + 1}@paytm`), payerMasked: maskVpa(`regular${(i % 39) + 1}@paytm`),
        items: [{ name: 'Chai patti 250g', qty: 1, price: amount }], settledAt: new Date(targetStart.getTime() + i * 9 * 60000) });
      total += amount; i += 1;
    }
    await Transaction.insertMany(extra);
    console.log(`   ${localParts(targetStart).dayKey} (${data.merchant.name}): ₹${Math.round(total).toLocaleString('en-IN')} in sales after the offer`);
  }
  // Two more lapsed regulars answered the win-back message.
  for (const vpa of ['old1@ybl', 'old2@ybl']) await api('POST', '/api/v1/payments/upi', { merchantId: MID, amount: 220, payerVpa: vpa });

  const result = await learn(MID, { now: new Date(Date.now() + 8 * 864e5) });
  result.outcomes.forEach((o) => console.log(`   📈 ${o.kind}: ${o.metric} — baseline ${o.baseline}, observed ${o.observed} (${o.liftPct > 0 ? '+' : ''}${o.liftPct}%) → ${o.verdict}`));
  const m = await Merchant.findOne({ merchantId: MID }).lean();
  console.log('   🧠 merchant.learning →', JSON.stringify(m.learning));

  step(10, 'Audit trail: why did the agent auto-send that offer?', 'GET /agent/actions');
  const { actions } = await api('GET', `/api/v1/agent/actions?merchantId=${MID}&limit=50`);
  const sent = actions.find((a) => a.kind === 'WHATSAPP_OFFER');
  if (sent) sent.decisionTrace.forEach((t) => console.log(`   ${t.result === 'pass' ? '✔' : '•'} ${t.rule.padEnd(20)} ${t.detail}`));

  console.log(`\n${bold('Done.')} Every message above is stored in the channelmessages collection (mock mode unless channel credentials are set).\n`);
  server.close();
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
