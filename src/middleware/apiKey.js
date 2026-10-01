const config = require('../config');
const { safeEqualHex } = require('../utils/crypto');
const crypto = require('crypto');

// Merchant-facing API auth (Paytm App, Soundbox cloud, WhatsApp bot, partner apps).
// Hackathon scope: one shared key. Production: per-merchant OAuth tokens from Paytm.
function requireApiKey(req, res, next) {
  const key = req.get('x-api-key') || '';
  const a = crypto.createHash('sha256').update(key).digest('hex');
  const b = crypto.createHash('sha256').update(config.apiKey).digest('hex');
  if (!config.apiKey || !safeEqualHex(a, b)) return res.status(401).json({ error: 'invalid or missing x-api-key' });
  next();
}

module.exports = requireApiKey;
