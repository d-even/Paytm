// n8n = the execution backbone. The agent still decides (Observe → Reason → Decide, trust engine);
// once an action is allowed to run, n8n executes it: WhatsApp broadcast, inventory reorder, Paytm surface.
//
// What we send is already filtered: opt-in, cooldown, daily cap and quiet hours were applied by our own
// backend, so n8n never gets database access and never sees a customer who should not be messaged.
//
// Off unless N8N_WEBHOOK_URL is set. When it is on and n8n fails, the action is marked failed: we do NOT fall
// back to the built-in sender, because n8n may already have messaged some customers (a retry would double-send).
const config = require('../config');
const { postJson } = require('../channels/http');
const { hmacSha256Hex } = require('../utils/crypto');
const { bus, EVENTS } = require('../events/bus');
const log = require('../utils/logger');

const ROUTE_OF = { WHATSAPP_OFFER: 'whatsapp', WINBACK_MESSAGE: 'whatsapp', RESTOCK_ALERT: 'inventory', CREDIT_OFFER: 'paytm' };

const enabled = () => Boolean(config.n8n.webhookUrl);
const routeFor = (kind) => ROUTE_OF[kind] || 'other';

// Everything n8n needs to act, plus the trust trail so the workflow (and a human reading the execution) can see why.
function buildEnvelope({ route, action, merchant, recipients = [], message, callbackBase = config.publicBaseUrl }) {
  const trace = (Array.isArray(action.decisionTrace) ? action.decisionTrace : []).map((t) => `${t.rule}: ${t.result}${t.detail ? ` (${t.detail})` : ''}`);
  return {
    event: 'agent.action',
    route,
    sentAt: new Date().toISOString(),
    actionId: String(action._id),
    kind: action.kind,
    merchant: { id: merchant.merchantId, name: merchant.name, language: merchant.language },
    trust: {
      family: action.family, riskTier: action.riskTier, mode: action.mode, decidedBy: action.decidedBy || 'agent',
      confidence: action.confidence ?? null, reasoning: action.reasoning || '', trace,
    },
    message: message ?? action.payload?.message ?? '',
    recipients: recipients.map((r) => ({ id: String(r._id), phone: r.phone, name: r.displayName || '' })),
    payload: action.payload || {},
    callbackUrl: callbackBase ? `${callbackBase}/api/v1/n8n/callback` : '',
  };
}

function headersFor(body) {
  const { sharedSecret } = config.n8n;
  if (!sharedSecret) return {};
  const ts = String(Math.floor(Date.now() / 1000));
  return {
    'x-vm-secret': sharedSecret, // for n8n's "Header Auth" on the Webhook node
    'x-vm-timestamp': ts,
    'x-vm-signature': hmacSha256Hex(sharedSecret, `${ts}.${JSON.stringify(body)}`), // for workflows that verify the body
  };
}

// POST the envelope and wait for the workflow's "Respond to Webhook". Throws if n8n is down, errors, or says ok:false.
async function run(envelope) {
  if (!enabled()) throw new Error('n8n is not configured');
  let res;
  try {
    res = await postJson(config.n8n.webhookUrl, envelope, headersFor(envelope), config.n8n.timeoutMs);
  } catch (err) {
    const detail = err.response?.message || err.response?.error || (typeof err.response === 'string' ? err.response.slice(0, 200) : '');
    throw new Error(`n8n workflow failed: ${err.message}${detail ? ` — ${detail}` : ''}`);
  }
  if (!res || typeof res !== 'object' || res.ok === false) {
    throw new Error(`n8n workflow refused: ${res?.reason || res?.error || 'no ok:true in the response'}`);
  }
  return res;
}

// WhatsApp via n8n. Same result shape as channels.whatsapp.broadcast so act.js treats both alike.
async function whatsappBroadcast({ action, merchant, recipients, text }) {
  const { ChannelMessage } = require('../models');
  const res = await run(buildEnvelope({ route: 'whatsapp', action, merchant, recipients, message: text }));
  const byPhone = new Map((Array.isArray(res.results) ? res.results : []).map((r) => [String(r.phone).replace(/\D/g, ''), r.status]));
  const sentTotal = Number.isFinite(res.sent) ? res.sent : recipients.length;
  let handedOut = 0;
  const docs = recipients.map((r) => {
    const known = byPhone.get(String(r.phone).replace(/\D/g, ''));
    const ok = known ? known === 'sent' : handedOut++ < sentTotal;
    return { merchantId: merchant.merchantId, actionId: action._id, channel: 'whatsapp', to: r.phone, text, mode: 'n8n', status: ok ? 'sent' : 'failed' };
  });
  const msgs = await ChannelMessage.insertMany(docs);
  const sent = msgs.filter((m) => m.status === 'sent').length;
  bus.emit(EVENTS.CHANNEL_MESSAGE, { channel: 'whatsapp', merchantId: merchant.merchantId, text, to: `${sent} customers`, mode: 'n8n' });
  log.info('channel:n8n', `💬 n8n sent ${sent}/${recipients.length} WhatsApp messages (execution ${res.executionId || 'n/a'})`);
  return { sent, failed: msgs.length - sent, messageIds: msgs.map((m) => m._id), via: 'n8n', executionId: res.executionId || null };
}

// Inventory / Paytm-surface routes: the action itself already happened in-app, n8n does the extra work
// (draft a supplier order, update a sheet, ping a partner surface). Best effort: never fails the action.
async function notify(action, merchant) {
  if (!enabled()) return null;
  try {
    const res = await run(buildEnvelope({ route: routeFor(action.kind), action, merchant }));
    log.info('channel:n8n', `${action.kind} handed to n8n (${res.executionId || 'ok'})`);
    return { ok: true, executionId: res.executionId || null, note: res.note || res.draft || null };
  } catch (err) {
    log.warn('channel:n8n', `${action.kind}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { enabled, routeFor, buildEnvelope, headersFor, run, whatsappBroadcast, notify };
