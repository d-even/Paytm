// Delivery receipts from the n8n workflow (WhatsApp delivered / read / replied / failed) come back here, so the
// outcome of an action is stored next to it. Auth: the shared secret, in the same x-vm-secret header n8n gets from us.
const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { AgentAction } = require('../models');

const router = express.Router();
const EVENTS = new Set(['delivered', 'read', 'replied', 'failed']);

function sameSecret(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(config.n8n.sharedSecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/callback', async (req, res, next) => {
  try {
    if (!config.n8n.sharedSecret) return res.status(503).json({ error: 'N8N_SHARED_SECRET is not set on the server' });
    if (!sameSecret(req.get('x-vm-secret'))) return res.status(401).json({ error: 'bad secret' });
    const { actionId, event } = req.body || {};
    if (!/^[a-f0-9]{24}$/i.test(String(actionId || ''))) return res.status(400).json({ error: 'actionId must be an action id' });
    if (!EVENTS.has(event)) return res.status(400).json({ error: `event must be one of ${[...EVENTS].join(', ')}` });
    const r = await AgentAction.updateOne({ _id: actionId }, { $inc: { [`result.receipts.${event}`]: 1 } });
    if (!r.matchedCount) return res.status(404).json({ error: 'action not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
