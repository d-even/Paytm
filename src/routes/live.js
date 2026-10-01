// Server-Sent Events feed for the laptop screen: Soundbox lines (spoken by the browser),
// bill/payment updates, card scans, WhatsApp sends, insights and approvals — live.
const { Router } = require('express');
const crypto = require('crypto');
const config = require('../config');
const { bus, EVENTS } = require('../events/bus');
const { safeEqualHex } = require('../utils/crypto');

const router = Router();
const clients = new Set();

function broadcast(type, data) {
  const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (!c.merchantId || !data.merchantId || c.merchantId === data.merchantId) c.res.write(line);
  }
}

bus.on(EVENTS.CHANNEL_MESSAGE, (d) => broadcast('channel', d));
bus.on(EVENTS.CHECKOUT_UPDATED, (d) => broadcast('checkout', d));
bus.on(EVENTS.CARD_SCANNED, (d) => broadcast('card', d));
bus.on(EVENTS.ACTION_EXECUTED, (a) => broadcast('action', {
  merchantId: a.merchantId, kind: a.kind, status: a.status, mode: a.mode, reasoning: a.reasoning,
}));

// EventSource can't send headers, so the key comes as ?key=
router.get('/live', (req, res) => {
  const hash = (v) => crypto.createHash('sha256').update(String(v || '')).digest('hex');
  if (!config.apiKey || !safeEqualHex(hash(req.query.key), hash(config.apiKey))) return res.status(401).end();

  res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);
  const client = { res, merchantId: req.query.merchantId };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
});

module.exports = router;
