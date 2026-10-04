// ④ ACT — execute an approved/auto action through the Channel layer, or queue it for
// the merchant's approval. Every path writes to the AgentAction audit trail.
const { AgentAction, AgentInsight, CustomerProfile, ChannelMessage, Merchant } = require('../models');
const channels = require('../channels');
const n8n = require('../integrations/n8n');
const memory = require('../integrations/cognee');
const { offerFact } = require('../integrations/memoryFacts');
const { bus, EVENTS } = require('../events/bus');
const { daysAgo } = require('../utils/time');
const log = require('../utils/logger');

const OPT_OUT_FOOTER = '\n\nReply STOP to stop offers.';

// Recipients are resolved at EXECUTION time (not when proposed) so an action approved
// hours later still respects opt-outs and doesn't re-message someone just contacted.
async function resolveAudience(merchantId, audience, now = new Date()) {
  const segments = audience === 'dormant' ? ['dormant'] : audience === 'regulars' ? ['regular'] : [];
  if (!segments.length) return [];
  return CustomerProfile.find({
    merchantId,
    segment: { $in: segments },
    whatsappOptIn: true,
    phone: { $exists: true, $ne: '' },
    $or: [{ lastOfferAt: null }, { lastOfferAt: { $lt: daysAgo(3, now) } }],
  }).lean();
}

async function countAutoMessagesToday(merchantId) {
  return ChannelMessage.countDocuments({ merchantId, channel: 'whatsapp', createdAt: { $gte: daysAgo(1) } });
}

const handlers = {
  async WHATSAPP_OFFER(action, merchant) {
    const recipients = await resolveAudience(merchant.merchantId, action.payload.audience);
    if (!recipients.length) return { skipped: true, reason: 'no opted-in recipients right now' };
    const text = action.payload.message + OPT_OUT_FOOTER;
    // n8n (when configured) runs the broadcast; otherwise the built-in WhatsApp channel does. Same result either way.
    const res = n8n.enabled()
      ? await n8n.whatsappBroadcast({ action, merchant, recipients, text })
      : await channels.whatsapp.broadcast({ merchantId: merchant.merchantId, recipients, text, actionId: action._id });
    await CustomerProfile.updateMany({ _id: { $in: recipients.map((r) => r._id) } }, { $set: { lastOfferAt: new Date() } });
    // Close the loop with the merchant, by voice.
    const en = (merchant.language || '').startsWith('en');
    const who = action.kind === 'WINBACK_MESSAGE' ? (en ? 'customers who stopped visiting' : 'purane customers') : (en ? 'regular customers' : 'regular customers');
    await channels.soundbox.speak({
      merchant, actionId: action._id,
      text: en ? `I sent your offer to ${res.sent} ${who} on WhatsApp.` : `Maine aapke ${res.sent} ${who} ko WhatsApp par offer bhej diya hai.`,
    });
    memory.remember(merchant.merchantId, offerFact({ merchantName: merchant.name, action, result: res }));
    return { ...res, recipients: recipients.length, recipientIds: recipients.map((r) => r._id) };
  },

  async WINBACK_MESSAGE(action, merchant) {
    return handlers.WHATSAPP_OFFER(action, merchant);
  },

  async LOYALTY_NUDGE(action, merchant) {
    const msg = await channels.soundbox.speak({ merchant, text: action.payload.message, actionId: action._id });
    return { spoken: true, messageId: msg._id };
  },

  async RESTOCK_ALERT(action, merchant) {
    const msg = await channels.dashboard.push({ merchantId: merchant.merchantId, event: 'restock.alert', data: action.payload, actionId: action._id });
    const automation = await n8n.notify(action, merchant); // e.g. draft the supplier order
    return { pushed: true, messageId: msg._id, ...(automation ? { n8n: automation } : {}) };
  },

  // Showing the offer is the action. Applying for the loan is always the merchant's
  // own step in the Paytm app — the agent never submits an application.
  async CREDIT_OFFER(action, merchant) {
    const msg = await channels.dashboard.push({ merchantId: merchant.merchantId, event: 'credit.offer', data: action.payload, actionId: action._id });
    const automation = await n8n.notify(action, merchant); // surface it on the Paytm side
    return { offerShown: true, messageId: msg._id, ...(automation ? { n8n: automation } : {}) };
  },

  async DAILY_BRIEFING(action, merchant) {
    const msg = await channels.soundbox.speak({ merchant, text: action.payload.message, actionId: action._id });
    return { spoken: true, messageId: msg._id };
  },
};

async function execute(action, merchant) {
  const handler = handlers[action.kind];
  try {
    const result = await handler(action, merchant);
    action.status = result?.skipped ? 'skipped' : 'executed';
    action.result = result;
    action.executedAt = new Date();
    const brief = Object.fromEntries(Object.entries(result || {}).filter(([k]) => !/Ids?$/.test(k)));
    log.info('agent:act', `${action.kind} → ${action.status}`, brief);
  } catch (err) {
    action.status = 'failed';
    action.result = { error: err.message };
    log.error('agent:act', `${action.kind} failed: ${err.message}`);
  }
  await action.save();
  if (action.insightId && action.status === 'executed') {
    await AgentInsight.updateOne({ _id: action.insightId }, { $set: { status: 'actioned' } });
  }
  bus.emit(EVENTS.ACTION_EXECUTED, action);
  bus.emit(EVENTS.ACTION_UPDATED, action);
  return action;
}

// Create the audit record, then either execute now (auto) or wait for the merchant.
async function dispatch({ merchant, proposal, decision, cycleId, insightId }) {
  const action = await AgentAction.create({
    merchantId: merchant.merchantId,
    cycleId,
    insightId,
    kind: proposal.kind,
    family: proposal.family,
    riskTier: proposal.riskTier,
    mode: decision.mode === 'auto' ? 'auto' : 'recommend',
    status: decision.mode === 'auto' ? 'approved' : 'pending_approval',
    payload: proposal.payload,
    reasoning: proposal.reasoning,
    confidence: proposal.confidence,
    decisionTrace: decision.trace,
  });

  if (decision.mode === 'auto') {
    // Customer-facing auto actions stay reversible for the merchant's undo window.
    if (proposal.family === 'marketing') {
      action.undoUntil = new Date(Date.now() + (merchant.settings?.undoWindowMinutes ?? 30) * 60_000);
    }
    return execute(action, merchant);
  }

  log.info('agent:act', `${action.kind} queued for merchant approval (id ${action._id})`);
  await channels.dashboard.push({
    merchantId: merchant.merchantId,
    event: 'action.needs_approval',
    data: { actionId: action._id, kind: action.kind, title: proposal.payload?.title, summary: proposal.reasoning, message: proposal.payload?.message },
    actionId: action._id,
  });
  bus.emit(EVENTS.ACTION_UPDATED, action);
  return action;
}

// Merchant's answer to a recommend-only action (POST /agent/action/approve).
async function resolveApproval({ merchantId, actionId, decision, edits }) {
  const action = await AgentAction.findOne({ _id: actionId, merchantId });
  if (!action) throw Object.assign(new Error('action not found'), { status: 404 });
  if (action.status !== 'pending_approval') throw Object.assign(new Error(`action is already ${action.status}`), { status: 409 });

  action.decidedBy = 'merchant';
  if (decision === 'reject') {
    action.status = 'rejected';
    await action.save();
    if (action.insightId) await AgentInsight.updateOne({ _id: action.insightId }, { $set: { status: 'dismissed' } });
    log.info('agent:act', `merchant rejected ${action.kind}`);
    bus.emit(EVENTS.ACTION_UPDATED, action);
    return action;
  }
  if (Number.isFinite(edits?.costCap) && edits.costCap > 0) {
    action.payload = { ...action.payload, costCap: Math.round(edits.costCap) };
    action.markModified('payload');
  }
  action.status = 'approved';
  await action.save();
  const merchant = await Merchant.findOne({ merchantId });
  return execute(action, merchant);
}

// Merchant controls on something the agent did on its own: pause / resume / undo.
// Undo is only possible inside the undo window. A WhatsApp message that was already
// delivered can't be recalled — undoing stops the offer (the counter stops honouring it).
async function controlAction({ merchantId, actionId, decision, now = new Date() }) {
  const action = await AgentAction.findOne({ _id: actionId, merchantId });
  if (!action) throw Object.assign(new Error('action not found'), { status: 404 });
  const fail = (msg) => Object.assign(new Error(msg), { status: 409 });

  if (decision === 'pause') {
    if (action.status !== 'executed' || action.decidedBy !== 'agent') throw fail('Only running automatic actions can be paused');
    action.status = 'paused';
  } else if (decision === 'resume') {
    if (action.status !== 'paused') throw fail('Only paused actions can be resumed');
    action.status = 'executed';
  } else if (decision === 'undo') {
    if (!['executed', 'paused'].includes(action.status) || action.decidedBy !== 'agent') throw fail('Only automatic actions can be undone');
    if (!action.undoUntil || action.undoUntil < now) throw fail('The undo window has closed');
    action.status = 'undone';
    if (action.insightId) await AgentInsight.updateOne({ _id: action.insightId }, { $set: { status: 'open' } });
  } else {
    throw Object.assign(new Error(`unknown decision ${decision}`), { status: 400 });
  }
  action.result = { ...(action.result || {}), [`${decision}dAt`]: now };
  action.markModified('result');
  await action.save();
  log.info('agent:act', `merchant ${decision === 'undo' ? 'undid' : `${decision}d`} ${action.kind}`);
  bus.emit(EVENTS.ACTION_UPDATED, action);
  return action;
}

module.exports = { dispatch, execute, resolveApproval, controlAction, resolveAudience, countAutoMessagesToday };
