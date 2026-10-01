// DATA LAYER entry points.
//   POST /payments/upi   primary stream   — UPI/QR settlement webhook (mocked gateway)
//   POST /pos/tap        complementary    — signed request from the ESP32 RFID terminal
const { Router } = require('express');
const requireApiKey = require('../middleware/apiKey');
const requireDeviceSignature = require('../middleware/deviceAuth');
const gateway = require('../services/paymentGateway');
const customerService = require('../services/customerService');
const { Merchant } = require('../models');
const { hashIdentity } = require('../utils/crypto');
const { need, positiveAmount } = require('../utils/validate');
const log = require('../utils/logger');

const router = Router();

function publicTxn(txn, customer) {
  return {
    txnId: txn.txnId, merchantId: txn.merchantId, amount: txn.amount, channel: txn.channel, status: txn.status,
    settledAt: txn.settledAt, payer: txn.payerMasked,
    customer: customer ? { visitCount: customer.visitCount, segment: customer.segment } : null,
  };
}

router.post('/payments/upi', requireApiKey, async (req, res) => {
  need(req.body, ['merchantId', 'amount', 'payerVpa']);
  if (!(await Merchant.exists({ merchantId: req.body.merchantId }))) return res.status(404).json({ error: 'merchant not found' });
  log.info('data', `UPI payment received for ${req.body.merchantId}`);
  const { txn, customer } = await gateway.processUpiPayment({
    merchantId: req.body.merchantId,
    amount: positiveAmount(req.body.amount),
    payerVpa: String(req.body.payerVpa),
    items: Array.isArray(req.body.items) ? req.body.items : [],
  });
  res.status(201).json(publicTxn(txn, customer));
});

router.post('/pos/tap', requireDeviceSignature, async (req, res) => {
  need(req.body, ['merchantId', 'amount', 'rfidUid']);
  const merchant = await Merchant.findOne({ merchantId: req.body.merchantId });
  if (!merchant || !merchant.posDeviceIds.includes(req.deviceId)) {
    return res.status(403).json({ error: 'device is not registered to this merchant' });
  }
  log.info('pos', `card tap on ${req.deviceId} (₹${req.body.amount})`);
  const { txn, customer } = await gateway.processPosTap({
    merchantId: merchant.merchantId,
    amount: positiveAmount(req.body.amount),
    rfidUid: String(req.body.rfidUid),
    deviceId: req.deviceId,
    items: Array.isArray(req.body.items) ? req.body.items : [],
  });
  // Keep the response tiny — the ESP32 shows it on a 16x2 LCD.
  const tag = customer?.segment === 'regular' || customer?.segment === 'dormant' ? 'REGULAR' : customer?.visitCount > 1 ? 'RETURNING' : 'NEW';
  res.status(201).json({ ok: true, txnId: txn.txnId, amount: txn.amount, visit: customer?.visitCount || 1, tag });
});

// One-time linking of an RFID card to a customer's UPI identity (done at the counter),
// so taps and UPI payments build ONE customer history.
router.post('/pos/link-card', requireApiKey, async (req, res) => {
  need(req.body, ['merchantId', 'rfidUid', 'payerVpa']);
  const profile = await customerService.linkIdentity(
    req.body.merchantId, hashIdentity('upi', req.body.payerVpa), hashIdentity('rfid', req.body.rfidUid)
  );
  if (!profile) return res.status(404).json({ error: 'no customer with that UPI ID has paid this merchant yet' });
  res.json({ linked: true, visitCount: profile.visitCount, segment: profile.segment });
});

module.exports = router;
