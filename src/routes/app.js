// API for the React merchant app (frontend/). Same paths and JSON shapes as the app's
// typed client (frontend/src/lib/api.ts), backed by the real agent, MongoDB and the counter.
const { Router } = require('express');
const config = require('../config');
const agent = require('../agent');
const { resolveApproval, controlAction } = require('../agent/act');
const { Merchant, AgentAction, CustomerProfile } = require('../models');
const checkout = require('../services/checkoutService');
const customerService = require('../services/customerService');
const views = require('../services/appViews');
const { buildSnapshot } = require('../agent/observe');
const { requireApp, issueToken } = require('../middleware/appAuth');
const { bus, EVENTS } = require('../events/bus');
const { hashIdentity, maskUid } = require('../utils/crypto');
const log = require('../utils/logger');

const router = Router();
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const httpError = (status, message) => Object.assign(new Error(message), { status });

// ── Sign-in (demo OTP: any 6 digits except 000000) ───────────────────────────────
router.post('/auth/otp', (req, res) => {
  const phone = String(req.body?.phone || '');
  if (!INDIAN_MOBILE.test(phone)) return res.status(422).json({ error: 'Enter a valid 10-digit mobile number' });
  res.json({ phoneMasked: `+91 ${phone.slice(0, 2)}******${phone.slice(-2)}`, resendAfterSeconds: 30 });
});

router.post('/auth/verify', async (req, res) => {
  const phone = String(req.body?.phone || '');
  const otp = String(req.body?.otp || '');
  if (!INDIAN_MOBILE.test(phone)) return res.status(422).json({ error: 'Enter a valid 10-digit mobile number' });
  if (!/^\d{6}$/.test(otp)) return res.status(422).json({ error: 'Enter the 6-digit OTP' });
  if (otp === '000000') return res.status(401).json({ error: 'Incorrect OTP' });
  // A number registered to a merchant signs into that shop; any other number gets the default shop
  // (or, if DEFAULT_MERCHANT_ID in .env is stale, the newest shop in the database).
  const merchant = (await Merchant.findOne({ phone: `+91${phone}` }))
    || (await Merchant.findOne({ merchantId: config.defaultMerchantId }))
    || (await Merchant.findOne().sort({ _id: -1 }));
  if (!merchant) return res.status(404).json({ error: 'No shop found - run npm run seed' });
  res.json({ merchant: views.merchantView(merchant), token: issueToken(merchant.merchantId) });
});

// ── Live feed (Server-Sent Events): payments, card scans, agent voice, action updates ──
const clients = new Set();
function send(merchantId, type, data) {
  const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) if (c.merchantId === merchantId) c.res.write(line);
}

bus.on(EVENTS.CHECKOUT_UPDATED, (c) => {
  if (c.status !== 'paid' || !c.txnId) return;
  Promise.all([views.paymentForTxnId(c.merchantId, c.txnId), views.todaySummary(c.merchantId)])
    .then(([payment, today]) => payment && send(c.merchantId, 'payment', { payment: { ...payment, billId: c.checkoutId }, today }))
    .catch((err) => log.error('app:live', err.message));
});
bus.on(EVENTS.CARD_SCANNED, (d) => {
  customerService.findByIdentity(d.merchantId, hashIdentity('rfid', d.rfidUid))
    // known = this card already belongs to a named customer; otherwise the counter offers to link it.
    .then((p) => send(d.merchantId, 'card', { rfidUid: d.rfidUid, known: Boolean(p?.displayName), visits: p?.visitCount || 0, label: p?.displayName || null }))
    .catch(() => {});
});
// Only the agent's own words — payment confirmations are already announced by the app itself.
bus.on(EVENTS.CHANNEL_MESSAGE, (m) => {
  if (m.channel === 'soundbox' && m.actionId) send(m.merchantId, 'voice', { text: m.text, lang: m.lang, ...(m.audio ? { audio: m.audio, mime: m.mime } : {}) });
  if (m.channel === 'whatsapp') send(m.merchantId, 'whatsapp', { to: m.to, mode: m.mode });
});
bus.on(EVENTS.ACTION_UPDATED, (a) => send(a.merchantId, 'action', { id: String(a._id), kind: a.kind, status: a.status }));
bus.on(EVENTS.INSIGHT_CREATED, (i) => send(i.merchantId, 'insight', { id: String(i._id), type: i.type }));

router.get('/live', requireApp, (req, res) => {
  res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.flushHeaders();
  res.write('event: hello\ndata: {}\n\n');
  const client = { res, merchantId: req.merchantId };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
});

// Everything below needs a signed-in merchant.
router.use(requireApp);

router.get('/merchant/profile', async (req, res) => res.json(views.merchantView(await views.getMerchant(req.merchantId))));

// ── Agent ────────────────────────────────────────────────────────────────────────
router.get('/agent/insights', async (req, res) => res.json(await views.insightsView(req.merchantId)));
router.get('/agent/actions', async (req, res) => res.json(await views.listActions(req.merchantId)));

router.post('/agent/action/approve', async (req, res) => {
  const { actionId, decision, edits } = req.body || {};
  if (!actionId || !/^[a-f0-9]{24}$/i.test(actionId)) throw httpError(404, `Action ${actionId} not found`);
  if (['approve', 'reject'].includes(decision)) {
    await resolveApproval({ merchantId: req.merchantId, actionId, decision, edits });
  } else if (['pause', 'resume', 'undo'].includes(decision)) {
    await controlAction({ merchantId: req.merchantId, actionId, decision });
  } else {
    throw httpError(422, 'decision must be approve, reject, pause, resume or undo');
  }
  res.json(await views.actionById(req.merchantId, actionId));
});

router.get('/agent/settings/trust', async (req, res) => res.json(views.trustView(await views.getMerchant(req.merchantId))));
router.put('/agent/settings/trust', async (req, res) => res.json(await views.updateTrust(req.merchantId, req.body || {})));
router.get('/agent/outcomes', async (req, res) => res.json(await views.outcomesView(req.merchantId, new Date(), { lang: req.query.lang === 'en' ? 'en' : 'hinglish' })));
router.get('/agent/cashflow', async (req, res) => res.json(await views.cashflowView(req.merchantId)));
router.get('/agent/campaigns', async (req, res) => res.json(await views.campaignsView(req.merchantId)));
router.get('/agent/regulars', async (req, res) => res.json(await views.regularsView(req.merchantId)));
router.get('/agent/history', async (req, res) => res.json(await views.historyView(req.merchantId)));

const FOLLOW_UPS = {
  en: ['How much did I sell today?', 'Which day is slowest?', 'Am I eligible for a loan?'],
  hinglish: ['Aaj ki sale kitni hui?', 'Kaunsa din sabse slow hai?', 'Loan mil sakta hai?'],
  hi: ['आज की बिक्री कितनी हुई?', 'कौन सा दिन सबसे धीमा है?', 'क्या मुझे लोन मिल सकता है?'],
  mr: ['आज किती विक्री झाली?', 'कोणता दिवस सर्वात मंद आहे?', 'मला कर्ज मिळू शकते का?'],
};

router.post('/agent/query', async (req, res) => {
  const question = String(req.body?.question || '').slice(0, 500);
  const language = req.body?.language || 'hinglish';
  if (!question.trim()) throw httpError(422, 'Ask a question');
  const out = await agent.query(req.merchantId, question, { language: language === 'en' ? 'en' : 'hinglish' });
  const f = out.facts;
  const q = question.toLowerCase();
  const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  let card;
  if (/(aaj|today|आज)/.test(q)) {
    card = { type: 'metric', label: 'Today so far', value: inr(f.today.sales), caption: `${f.today.payments} payments` };
  } else if (/(hafte|week|din|day|slow|dip|kam|दिन|हफ्ते|आठवड)/.test(q)) {
    const snap = await buildSnapshot(req.merchantId);
    const last7 = snap.daily.filter((d) => d.dayKey < snap.todayKey).slice(-7);
    const min = Math.min(...last7.map((d) => d.total));
    card = {
      type: 'bars', label: 'Sales, last 7 days',
      data: last7.map((d) => ({ label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday], value: Math.round(d.total), highlight: d.total === min })),
    };
  } else if (/(loan|credit|udhar|लोन|कर्ज)/.test(q)) {
    const offer = await AgentAction.findOne({ merchantId: req.merchantId, kind: 'CREDIT_OFFER' }).sort({ createdAt: -1 }).lean();
    if (offer?.payload?.indicativeLimit) card = { type: 'metric', label: 'Indicative loan limit', value: inr(offer.payload.indicativeLimit), caption: 'Recommend only · lender decides' };
  } else if (/(customer|grahak|regular|ग्राहक)/.test(q)) {
    card = { type: 'metric', label: 'Regular customers', value: String(f.customers.regulars), caption: `${f.customers.dormant} haven't come back recently` };
  }
  res.json({ answer: out.answer, ...(card ? { card } : {}), followUps: FOLLOW_UPS[language] || FOLLOW_UPS.hinglish });
});

// "Run agent now": full Observe → Reason → Decide → Act → Learn cycle, reported for the counter.
router.post('/agent/run', async (req, res) => {
  const now = new Date();
  const summary = await agent.runCycle(req.merchantId, { now });
  const [today, snapshot, merchant] = await Promise.all([
    views.todaySummary(req.merchantId, now), buildSnapshot(req.merchantId, { now }), views.getMerchant(req.merchantId),
  ]);
  const created = (summary.actions || []).filter((a) => a.status !== 'skipped');
  let newAction = null;
  for (const a of created) {
    newAction = await views.actionById(req.merchantId, a.id);
    if (newAction) break;
  }
  let skippedType = null;
  for (const a of (summary.actions || []).filter((x) => x.status === 'skipped')) {
    const doc = await AgentAction.findById(a.id).lean();
    if (doc?.decisionTrace?.[0]?.result === 'fail') { skippedType = views.TYPE_OF[doc.family] || null; break; }
  }
  res.json({ ranAt: now.toISOString(), today, pacePct: views.pacePct(snapshot, today.sales, now), newAction, skippedType, cycle: { insightsCreated: summary.insightsCreated || 0, usedLLM: Boolean(summary.usedLLM), merchant: merchant.merchantId } });
});

router.post('/agent/briefing', async (req, res) => {
  const action = await agent.dailyBriefing(req.merchantId);
  res.json({ spoken: action?.payload?.message || null });
});

// ── Counter ──────────────────────────────────────────────────────────────────────
router.get('/counter/today', async (req, res) => res.json(await views.todaySummary(req.merchantId)));

router.post('/counter/bill', async (req, res) => {
  const amount = req.body?.amount;
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) throw httpError(422, 'Bill amount must be ₹1–₹1,00,000');
  res.status(201).json(views.billView(await checkout.createCheckout({ merchantId: req.merchantId, amount })));
});

router.post('/counter/bill/cancel', async (req, res) => {
  try { await checkout.cancelCheckout(req.merchantId, String(req.body?.billId || '')); } catch { /* already paid/expired: nothing to cancel */ }
  res.json({ ok: true });
});

// The app's "Tap card" button = a counter simulator for when the ESP32 reader isn't connected.
// It taps the shop's two card customers in turn (Chinu, then Shravni Chavan), through the same
// code path as a real tap. The UIDs are CARD_UID_CHINU / CARD_UID_SHRAVNI in .env.
const SIM_CARDS = [config.cards.chinu, config.cards.shravni];
let simTaps = 0;
router.post('/counter/bill/tap', async (req, res) => {
  const billId = String(req.body?.billId || '');
  if (!billId) throw httpError(422, 'billId required');
  const uid = SIM_CARDS[simTaps++ % SIM_CARDS.length];
  const r = await checkout.payByCard({ merchantId: req.merchantId, checkoutId: billId, rfidUid: uid });
  const [payment, today] = await Promise.all([views.paymentForTxnId(req.merchantId, r.txnId), views.todaySummary(req.merchantId)]);
  res.status(201).json({ payment: { ...payment, billId }, today });
});

// Link a physical RFID card (tapped with no bill open) to a known customer, or start a new one.
router.get('/counter/customers', async (req, res) => {
  const named = await CustomerProfile.find({ merchantId: req.merchantId, displayName: { $exists: true, $ne: null } }).sort({ visitCount: -1 }).limit(10).lean();
  res.json(named.map((p) => ({ id: String(p._id), name: p.displayName, visits: p.visitCount })));
});

router.post('/counter/card/link', async (req, res) => {
  const rfidUid = String(req.body?.rfidUid || '').toUpperCase();
  const customerId = String(req.body?.customerId || '');
  if (!/^[0-9A-F]{4,20}$/.test(rfidUid)) throw httpError(422, 'invalid card UID');
  const profile = await CustomerProfile.findOne({ _id: customerId, merchantId: req.merchantId }).catch(() => null);
  if (!profile) throw httpError(404, 'customer not found');
  const linked = await customerService.linkIdentity(req.merchantId, profile.customerKey, hashIdentity('rfid', rfidUid), maskUid(rfidUid));
  log.info('pos', `card ****${rfidUid.slice(-4)} linked to ${linked.displayName || views.customerLabel(linked)}`);
  res.json({ ok: true, label: linked.displayName || views.customerLabel(linked), visits: linked.visitCount });
});

module.exports = router;
