// The counter: one open bill per merchant, payable by RFID card OR QR.
//
//   laptop: merchant enters ₹240 ─► bill (pending) ─► screen shows QR + "tap card"
//      ├─ card tap on ESP32  ─► POST /pos/card  ─► payByCard ─┐
//      └─ phone scans QR     ─► POST /pay/:id   ─► payByUpi  ─┤
//                                                               ├─► gateway settles
//                                                               ├─► Soundbox: "₹240 prapt hue"
//                                                               └─► agent real-time recognition
const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../config');
const { Checkout, Merchant } = require('../models');
const gateway = require('./paymentGateway');
const customerService = require('./customerService');
const channels = require('../channels');
const { bus, EVENTS } = require('../events/bus');
const { hashIdentity } = require('../utils/crypto');
const { publicBaseUrl } = require('../utils/network');
const log = require('../utils/logger');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function publicView(c) {
  return {
    checkoutId: c.checkoutId, merchantId: c.merchantId, amount: c.amount, status: c.status, method: c.method,
    txnId: c.txnId, payer: c.payer, expiresAt: c.expiresAt, paidAt: c.paidAt,
  };
}

function emit(c, extra = {}) {
  bus.emit(EVENTS.CHECKOUT_UPDATED, { ...publicView(c), ...extra });
}

// The QR opens the pay page on the customer's phone (same Wi-Fi as this laptop).
async function qrFor(checkoutId) {
  const payUrl = `${publicBaseUrl()}/pay/${checkoutId}`;
  const qrSvg = await QRCode.toString(payUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { payUrl, qrSvg };
}

async function createCheckout({ merchantId, amount, items = [] }) {
  const merchant = await Merchant.findOne({ merchantId });
  if (!merchant) throw httpError(404, 'merchant not found');
  // Only one open bill per counter — a new bill replaces an unpaid one.
  await Checkout.updateMany({ merchantId, status: 'pending' }, { $set: { status: 'cancelled' } });

  const checkout = await Checkout.create({
    checkoutId: `CHK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    merchantId, amount, items,
    expiresAt: new Date(Date.now() + config.checkoutTtlSeconds * 1000),
  });
  const { payUrl, qrSvg } = await qrFor(checkout.checkoutId);
  log.info('data', `bill ${checkout.checkoutId} opened for ${inr(amount)} — card or QR`);
  emit(checkout, { payUrl, qrSvg });
  return { ...publicView(checkout), payUrl, qrSvg };
}

async function currentCheckout(merchantId) {
  const c = await Checkout.findOne({ merchantId, status: 'pending', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  return c ? { ...publicView(c), ...(await qrFor(c.checkoutId)) } : null;
}

async function cancelCheckout(merchantId, checkoutId) {
  const c = await Checkout.findOneAndUpdate({ merchantId, checkoutId, status: 'pending' }, { $set: { status: 'cancelled' } }, { returnDocument: 'after' });
  if (!c) throw httpError(404, 'no pending bill with that id');
  emit(c);
  return publicView(c);
}

// Atomically claim a pending bill so a card tap and a QR payment can't both pay it.
async function lock(filter) {
  return Checkout.findOneAndUpdate(
    { ...filter, status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'processing' } },
    { returnDocument: 'after', sort: { createdAt: -1 } }
  );
}

async function complete(checkout, merchant, { method, result }) {
  checkout.status = 'paid';
  checkout.method = method;
  checkout.txnId = result.txn.txnId;
  checkout.payer = result.txn.payerMasked;
  checkout.paidAt = new Date();
  await checkout.save();

  const c = result.customer;
  const tag = c?.segment === 'regular' || c?.segment === 'dormant' ? 'REGULAR' : c?.visitCount > 1 ? 'RETURNING' : 'NEW';
  emit(checkout, { tag, visit: c?.visitCount || 1 });

  // 1) Soundbox confirms the payment — exactly what a real Soundbox does…
  const en = (merchant.language || '').startsWith('en');
  const via = method === 'card' ? (en ? 'by card' : 'card se') : (en ? 'by UPI' : 'UPI se');
  await channels.soundbox.speak({ merchant, text: en ? `Received ${inr(checkout.amount)} ${via}.` : `${inr(checkout.amount)} prapt hue, ${via}.` });
  // 2) …then the agent's real-time recognition gets its turn (loyalty nudge, welcome back).
  bus.emit(EVENTS.POS_TAP, { ...result.realtimeEvent, via: method });
  return { ...publicView(checkout), tag, visit: c?.visitCount || 1 };
}

// Card tapped on the ESP32 reader (or the app's "tap card" simulator, which passes
// merchantId + checkoutId instead of a signed device).
async function payByCard({ deviceId, rfidUid, merchantId, checkoutId }) {
  const merchant = merchantId ? await Merchant.findOne({ merchantId }) : await Merchant.findOne({ posDeviceIds: deviceId });
  if (!merchant) throw httpError(403, 'device is not registered to any merchant');
  if (!deviceId) deviceId = merchant.posDeviceIds?.[0] || 'COUNTER-SIM';

  const checkout = await lock({ merchantId: merchant.merchantId, ...(checkoutId ? { checkoutId } : {}) });
  if (!checkout && checkoutId) {
    const c = await Checkout.findOne({ merchantId: merchant.merchantId, checkoutId });
    if (!c) throw httpError(404, 'Bill not found');
    if (c.status === 'pending') throw httpError(410, 'Bill expired');
    throw httpError(409, `Bill already ${c.status}`);
  }
  if (!checkout) {
    // No bill open: tell the laptop screen which card this is (used to register new cards).
    const known = await customerService.findByIdentity(merchant.merchantId, hashIdentity('rfid', rfidUid));
    bus.emit(EVENTS.CARD_SCANNED, { merchantId: merchant.merchantId, rfidUid, known: Boolean(known), visitCount: known?.visitCount || 0 });
    log.info('pos', `card ${rfidUid} scanned with no open bill`);
    throw httpError(409, 'no open bill - enter amount on laptop');
  }
  try {
    const result = await gateway.processPosTap(
      { merchantId: merchant.merchantId, amount: checkout.amount, rfidUid, deviceId, items: checkout.items },
      { emitRealtime: false }
    );
    return await complete(checkout, merchant, { method: 'card', result });
  } catch (err) {
    if (checkout.status === 'processing') { checkout.status = 'pending'; await checkout.save(); }
    throw err;
  }
}

// Customer scanned the QR and paid from their phone (mock UPI app page).
async function payByUpi({ checkoutId, payerVpa }) {
  const checkout = await lock({ checkoutId });
  if (!checkout) throw httpError(409, 'this bill is already paid, cancelled or expired');
  const merchant = await Merchant.findOne({ merchantId: checkout.merchantId });
  try {
    const result = await gateway.processUpiPayment({
      merchantId: checkout.merchantId, amount: checkout.amount, payerVpa, items: checkout.items, channel: 'QR',
    });
    result.realtimeEvent = { merchantId: checkout.merchantId, identityHash: result.txn.customerKey, txn: result.txn, customer: result.customer };
    return await complete(checkout, merchant, { method: 'qr', result });
  } catch (err) {
    if (checkout.status === 'processing') { checkout.status = 'pending'; await checkout.save(); }
    throw err;
  }
}

// Public, minimal view for the phone's pay page.
async function payPageInfo(checkoutId) {
  const c = await Checkout.findOne({ checkoutId });
  if (!c) throw httpError(404, 'bill not found');
  const m = await Merchant.findOne({ merchantId: c.merchantId }).lean();
  const expired = c.status === 'pending' && c.expiresAt < new Date();
  return { checkoutId, merchantName: m?.name, amount: c.amount, status: expired ? 'expired' : c.status, expiresAt: c.expiresAt };
}

module.exports = { createCheckout, currentCheckout, cancelCheckout, payByCard, payByUpi, payPageInfo };
