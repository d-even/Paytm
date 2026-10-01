const config = require('../config');
const { hmacSha256Hex, safeEqualHex } = require('../utils/crypto');
const log = require('../utils/logger');

// POS / RFID terminals sign every request:
//   x-device-id: POS-RAMESH-01
//   x-timestamp: 1767000000            (unix seconds, device syncs via NTP)
//   x-signature: hex( HMAC_SHA256(secret, `${deviceId}.${timestamp}.${rawBody}`) )
// → a stolen request can't be replayed (timestamp window + seen-signature cache)
//   or modified (body is inside the HMAC).
const seen = new Map(); // signature → expiry ms

function pruneSeen(now) {
  for (const [sig, exp] of seen) if (exp < now) seen.delete(sig);
}

function requireDeviceSignature(req, res, next) {
  const deviceId = req.get('x-device-id');
  const ts = parseInt(req.get('x-timestamp'), 10);
  const sig = (req.get('x-signature') || '').toLowerCase();
  const secret = deviceId && config.pos.deviceSecrets.get(deviceId);

  if (!secret) return res.status(401).json({ error: 'unknown device' });
  const now = Date.now();
  const skew = Math.abs(now / 1000 - ts);
  if (!Number.isFinite(ts) || skew > config.pos.maxClockSkewSeconds) {
    return res.status(401).json({ error: 'timestamp outside allowed window — check device NTP sync' });
  }
  const expected = hmacSha256Hex(secret, `${deviceId}.${ts}.${req.rawBody ? req.rawBody.toString('utf8') : ''}`);
  if (!safeEqualHex(sig, expected)) {
    log.warn('pos', `bad signature from ${deviceId}`);
    return res.status(401).json({ error: 'bad signature' });
  }
  pruneSeen(now);
  if (seen.has(sig)) return res.status(409).json({ error: 'replayed request' });
  seen.set(sig, now + config.pos.maxClockSkewSeconds * 2000);

  req.deviceId = deviceId;
  next();
}

module.exports = requireDeviceSignature;
