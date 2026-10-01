// The counter: laptop screen opens a bill; customer pays by RFID card OR by QR.
const { Router } = require('express');
const requireApiKey = require('../middleware/apiKey');
const requireDeviceSignature = require('../middleware/deviceAuth');
const checkout = require('../services/checkoutService');
const { need, positiveAmount } = require('../utils/validate');

const router = Router();
const VPA_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;

// ── Laptop counter screen (merchant) ─────────────────────────────
router.post('/checkout', requireApiKey, async (req, res) => {
  need(req.body, ['merchantId', 'amount']);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  res.status(201).json(await checkout.createCheckout({ merchantId: req.body.merchantId, amount: positiveAmount(req.body.amount), items }));
});

router.get('/checkout/current', requireApiKey, async (req, res) => {
  need(req.query, ['merchantId']);
  res.json({ checkout: await checkout.currentCheckout(req.query.merchantId) });
});

router.post('/checkout/:checkoutId/cancel', requireApiKey, async (req, res) => {
  need(req.body, ['merchantId']);
  res.json(await checkout.cancelCheckout(req.body.merchantId, req.params.checkoutId));
});

// ── ESP32 card reader: only sends the card UID; the amount comes from the open bill ──
router.post('/pos/card', requireDeviceSignature, async (req, res) => {
  need(req.body, ['rfidUid']);
  const r = await checkout.payByCard({ deviceId: req.deviceId, rfidUid: String(req.body.rfidUid).toUpperCase() });
  res.status(201).json({ ok: true, amount: r.amount, txnId: r.txnId, tag: r.tag, visit: r.visit });
});

// ── Customer's phone after scanning the QR (demo stand-in for their UPI app) ──
router.get('/pay/:checkoutId', async (req, res) => {
  res.json(await checkout.payPageInfo(req.params.checkoutId));
});

router.post('/pay/:checkoutId', async (req, res) => {
  need(req.body, ['payerVpa']);
  const payerVpa = String(req.body.payerVpa).trim();
  if (!VPA_RE.test(payerVpa)) return res.status(400).json({ error: 'enter a valid UPI ID, e.g. name@paytm' });
  const r = await checkout.payByUpi({ checkoutId: req.params.checkoutId, payerVpa });
  res.status(201).json({ ok: true, amount: r.amount, txnId: r.txnId });
});

module.exports = router;
