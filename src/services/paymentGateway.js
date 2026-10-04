const crypto = require('crypto');
const { Transaction, Merchant } = require('../models');
const { bus, EVENTS } = require('../events/bus');
const { hashIdentity, maskVpa, maskUid } = require('../utils/crypto');
const customerService = require('./customerService');
const memory = require('../integrations/cognee');
const { paymentFact } = require('../integrations/memoryFacts');
const log = require('../utils/logger');

// Mock of the Paytm payment gateway. In production this module is replaced by the
// gateway's settlement webhook; everything downstream (event bus → agent) stays the same.
//
//   Customer ─► POS/QR ─► [ this gateway ] ─► merchant account (settle)
//                                         └─► event bus ─► AI agent   (in parallel)

function newTxnId(prefix) {
  return `${prefix}${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function settle({ merchantId, amount, channel, source, identityHash, payerMasked, cardMasked, deviceId, items, at }) {
  if (!(amount > 0)) throw Object.assign(new Error('amount must be > 0'), { status: 400 });

  const txn = await Transaction.create({
    txnId: newTxnId(source === 'pos' ? 'POS' : 'UPI'),
    merchantId, amount, channel, source, status: 'SETTLED',
    customerKey: identityHash, payerMasked, deviceId, items,
    settledAt: at || new Date(),
  });
  log.info('gateway', `₹${amount} settled to merchant ${merchantId} via ${channel}`, { txnId: txn.txnId });

  // Itemised bill → shelf stock goes down (feeds the agent's "running low" reorder tool).
  for (const line of items || []) {
    if (!line?.name || !(line.qty > 0)) continue;
    await Merchant.updateOne(
      { merchantId }, { $inc: { 'inventory.$[i].stock': -line.qty } }, { arrayFilters: [{ 'i.name': line.name }] }
    ).catch(() => {});
  }

  // Observe: keep the customer profile current on every payment.
  const customer = identityHash
    ? await customerService.recordVisit({ merchantId, identityHash, amount, payerMasked, cardMasked, at: txn.settledAt })
    : null;

  if (memory.enabled()) {
    const m = await Merchant.findOne({ merchantId }, { name: 1 }).lean().catch(() => null);
    memory.remember(merchantId, paymentFact({ merchantName: m?.name || merchantId, txn, customer }));
  }

  bus.emit(EVENTS.TXN_SETTLED, { txn, customer });
  return { txn, customer };
}

// PRIMARY data stream — works for every merchant from day 1.
async function processUpiPayment({ merchantId, amount, payerVpa, items, at, channel = 'UPI' }) {
  const identityHash = payerVpa ? hashIdentity('upi', payerVpa) : undefined;
  return settle({ merchantId, amount, channel, source: 'upi', identityHash, payerMasked: maskVpa(payerVpa), items, at });
}

// COMPLEMENTARY data stream — a card/RFID tap at a POS terminal. Besides settling,
// it fires a real-time POS_TAP event so the agent can react while the customer is
// still standing at the counter.
// Pass { emitRealtime: false } when the caller wants to announce the payment first and
// fire the real-time event itself (the counter does this so "₹240 received" is spoken
// before the loyalty nudge).
async function processPosTap({ merchantId, amount, rfidUid, deviceId, items }, { emitRealtime = true } = {}) {
  const identityHash = hashIdentity('rfid', rfidUid);
  const result = await settle({
    merchantId, amount, channel: 'CARD_TAP', source: 'pos', identityHash, payerMasked: maskUid(rfidUid), cardMasked: maskUid(rfidUid), deviceId, items,
  });
  result.realtimeEvent = { merchantId, deviceId, identityHash, txn: result.txn, customer: result.customer, via: 'card' };
  if (emitRealtime) bus.emit(EVENTS.POS_TAP, result.realtimeEvent);
  return result;
}

module.exports = { processUpiPayment, processPosTap };
