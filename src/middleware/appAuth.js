// Auth for the merchant web app (React frontend).
//   • After OTP sign-in the app holds a short-lived session token (HMAC-signed, no DB).
//   • Server-to-server callers can still use x-api-key (+ x-merchant-id).
// Either way the request ends up with req.merchantId — the app never chooses it freely.
const crypto = require('crypto');
const config = require('../config');
const { safeEqualHex } = require('../utils/crypto');

const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;
const secret = () => crypto.createHash('sha256').update(`app-session|${config.apiKey}|${config.identityPepper}`).digest();
const b64 = (s) => Buffer.from(s).toString('base64url');

function issueToken(merchantId, now = Date.now()) {
  const body = b64(JSON.stringify({ m: merchantId, exp: now + TOKEN_TTL_MS }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('hex');
  return `${body}.${sig}`;
}

function verifyToken(token, now = Date.now()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('hex');
  if (!safeEqualHex(sig, expected)) return null;
  try {
    const { m, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return exp > now && m ? m : null;
  } catch {
    return null;
  }
}

function apiKeyOk(key) {
  if (!config.apiKey || !key) return false;
  const h = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
  return safeEqualHex(h(key), h(config.apiKey));
}

function requireApp(req, res, next) {
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const fromToken = verifyToken(bearer || req.query.token);
  if (fromToken) { req.merchantId = fromToken; return next(); }
  if (apiKeyOk(req.get('x-api-key') || req.query.key)) {
    req.merchantId = req.get('x-merchant-id') || req.query.merchantId || config.defaultMerchantId;
    return next();
  }
  return res.status(401).json({ error: 'sign in again' });
}

module.exports = { requireApp, issueToken, verifyToken };
