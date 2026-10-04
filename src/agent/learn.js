// ⑤ LEARN — close the feedback loop. For every executed action whose evaluation
// window has passed, measure what actually happened, store the outcome on the action,
// and roll it into merchant.learning. Reason (prompt context) and Decide (track-record
// rule) both read merchant.learning, so the agent gets sharper with every action.
const { AgentAction, Transaction, CustomerProfile, Merchant } = require('../models');
const config = require('../config');
const { localParts } = require('../utils/time');
const memory = require('../integrations/cognee');
const { outcomeFact } = require('../integrations/memoryFacts');
const log = require('../utils/logger');

const MEASURABLE = ['WHATSAPP_OFFER', 'WINBACK_MESSAGE'];

function verdictFor(liftPct, positiveAt = 5) {
  if (liftPct >= positiveAt) return 'positive';
  if (liftPct <= -positiveAt) return 'negative';
  return 'neutral';
}

async function salesOnDay(merchantId, dayKey) {
  const tz = config.agent.timezone;
  const [row] = await Transaction.aggregate([
    { $match: { merchantId, status: 'SETTLED' } },
    { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$settledAt', timezone: tz } } } },
    { $match: { day: dayKey } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return row ? row.total : 0;
}

// Targeted-day offer: compare sales on the target day with the pre-offer average for that weekday.
async function evaluateTargetedOffer(action, now) {
  const { targetDate, baseline } = action.payload || {};
  if (!targetDate || !baseline) return null;
  if (targetDate >= localParts(now).dayKey) return null; // target day not complete yet
  const observed = await salesOnDay(action.merchantId, targetDate);
  const liftPct = Math.round(((observed - baseline) / baseline) * 1000) / 10;
  return { metric: `sales on ${targetDate}`, baseline, observed: Math.round(observed), liftPct, verdict: verdictFor(liftPct) };
}

// Win-back: how many of the messaged customers actually came back within the window.
async function evaluateWinback(action, now) {
  const ids = action.result?.recipientIds || [];
  if (!ids.length) return null;
  const windowEnd = new Date(action.executedAt.getTime() + config.agent.learnEvalWindowHours * 36e5);
  if (now < windowEnd) return null;
  const returned = await CustomerProfile.countDocuments({ _id: { $in: ids }, lastSeen: { $gt: action.executedAt } });
  const rate = Math.round((returned / ids.length) * 1000) / 10;
  // A 15% return rate is the bar for "worked" — well above the natural drift back.
  return { metric: 'win-back return rate %', baseline: 15, observed: rate, liftPct: Math.round((rate - 15) * 10) / 10, verdict: verdictFor(rate - 15, 0.001) };
}

async function learn(merchantId, { now = new Date() } = {}) {
  const pending = await AgentAction.find({
    merchantId, status: 'executed', kind: { $in: MEASURABLE }, 'outcome.evaluatedAt': { $exists: false },
  });
  if (!pending.length) return { evaluated: 0, outcomes: [] };

  const merchant = await Merchant.findOne({ merchantId });
  const learning = merchant.learning || {};
  const outcomes = [];

  for (const action of pending) {
    const outcome = action.kind === 'WINBACK_MESSAGE'
      ? await evaluateWinback(action, now)
      : await evaluateTargetedOffer(action, now);
    if (!outcome) continue; // not ready yet

    action.outcome = { ...outcome, evaluatedAt: now };
    await action.save();

    const s = learning[action.kind] || { tried: 0, positive: 0, negative: 0, avgLiftPct: 0 };
    s.avgLiftPct = Math.round(((s.avgLiftPct * s.tried + outcome.liftPct) / (s.tried + 1)) * 10) / 10;
    s.tried += 1;
    if (outcome.verdict === 'positive') s.positive += 1;
    if (outcome.verdict === 'negative') s.negative += 1;
    s.lastLiftPct = outcome.liftPct;
    s.lastEvaluatedAt = now;
    learning[action.kind] = s;

    outcomes.push({ actionId: action._id, kind: action.kind, ...outcome });
    memory.remember(merchantId, outcomeFact({ merchantName: merchant.name, action, outcome }));
    const cur = outcome.metric.startsWith('sales') ? '₹' : '';
    log.info('agent:learn', `${action.kind}: ${outcome.metric} ${cur}${outcome.baseline} → ${cur}${outcome.observed} (${outcome.liftPct > 0 ? '+' : ''}${outcome.liftPct}%) → ${outcome.verdict}`);
  }

  merchant.learning = learning;
  merchant.markModified('learning');
  await merchant.save();
  if (outcomes.length) memory.flush(merchantId).catch(() => {}); // the graph learns from the new results now, not in a minute
  return { evaluated: outcomes.length, outcomes, learning };
}

module.exports = { learn, verdictFor };
