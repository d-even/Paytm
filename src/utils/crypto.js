const crypto = require('crypto');
const config = require('../config');

// Customer identifiers (UPI VPA, RFID card UID) are personal data.
// We only ever store a peppered SHA-256 hash — enough to recognise a returning
// customer, useless to anyone who steals the database.
function hashIdentity(kind, rawValue) {
  const normalised = String(rawValue).trim().toLowerCase();
  return crypto.createHash('sha256').update(`${config.identityPepper}|${kind}|${normalised}`).digest('hex');
}

// Show the last few characters only, e.g. "ra***@paytm" — safe for dashboards and logs.
function maskVpa(vpa) {
  if (!vpa || !vpa.includes('@')) return '***';
  const [user, bank] = vpa.split('@');
  return `${user.slice(0, 2)}***@${bank}`;
}

function maskUid(uid) {
  const s = String(uid || '');
  return s.length <= 4 ? '****' : `****${s.slice(-4)}`;
}

// HMAC used by POS/RFID devices to sign requests.
function hmacSha256Hex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

module.exports = { hashIdentity, maskVpa, maskUid, hmacSha256Hex, safeEqualHex };
