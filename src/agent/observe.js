// ① OBSERVE — build a snapshot of the merchant's business from the data layer.
// Heavy lifting is done inside MongoDB with aggregation pipelines (timezone-aware),
// so this scales to large merchants without pulling every transaction into Node.
const { Merchant, Transaction, CustomerProfile, AgentAction } = require('../models');
const config = require('../config');
const { localParts, startOfLocalDay, daysAgo } = require('../utils/time');
const log = require('../utils/logger');

async function dailyTotals(merchantId, since, tz) {
  return Transaction.aggregate([
    { $match: { merchantId, status: 'SETTLED', settledAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$settledAt', timezone: tz } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        weekday: { $first: { $subtract: [{ $dayOfWeek: { date: '$settledAt', timezone: tz } }, 1] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function hourlyCounts(merchantId, since, tz) {
  const rows = await Transaction.aggregate([
    { $match: { merchantId, status: 'SETTLED', settledAt: { $gte: since } } },
    { $group: { _id: { $hour: { date: '$settledAt', timezone: tz } }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, total: 0 }));
  rows.forEach((r) => { hours[r._id] = { hour: r._id, count: r.count, total: r.total }; });
  return hours;
}

async function itemUnits(merchantId, now) {
  const last7 = daysAgo(7, now);
  const since = daysAgo(28, now);
  const rows = await Transaction.aggregate([
    { $match: { merchantId, status: 'SETTLED', settledAt: { $gte: since, $lt: now } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        last7: { $sum: { $cond: [{ $gte: ['$settledAt', last7] }, '$items.qty', 0] } },
        prior21: { $sum: { $cond: [{ $lt: ['$settledAt', last7] }, '$items.qty', 0] } },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, { last7: r.last7, prior21: r.prior21 }]));
}

// Fill missing days with zero so "no sales on Tuesday" counts as a data point.
function fillDays(rows, since, now, tz) {
  const byKey = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  for (let t = since.getTime(); t <= now.getTime(); t += 864e5) {
    const { dayKey, weekday } = localParts(new Date(t), tz);
    if (out.length && out[out.length - 1].dayKey === dayKey) continue;
    const r = byKey.get(dayKey);
    out.push({ dayKey, weekday, total: r ? r.total : 0, count: r ? r.count : 0 });
  }
  return out;
}

async function buildSnapshot(merchantId, { now = new Date() } = {}) {
  const merchant = await Merchant.findOne({ merchantId });
  if (!merchant) throw Object.assign(new Error(`merchant ${merchantId} not found`), { status: 404 });

  const tz = config.agent.timezone;
  // Start at local midnight so the first day in the window is a full day.
  const since = startOfLocalDay(daysAgo(config.agent.lookbackDays, now), tz);
  const today = localParts(now, tz);

  const [dailyRows, hourly, items, customers, recentActions] = await Promise.all([
    dailyTotals(merchantId, since, tz),
    hourlyCounts(merchantId, since, tz),
    itemUnits(merchantId, now),
    CustomerProfile.find({ merchantId }).lean(),
    AgentAction.find({ merchantId, createdAt: { $gte: daysAgo(7, now) } }).sort({ createdAt: -1 }).lean(),
  ]);

  const daily = fillDays(dailyRows, since, now, tz);
  const snapshot = {
    merchant,
    now,
    todayKey: today.dayKey,
    todayWeekday: today.weekday,
    daily,
    hourly,
    itemUnits: items,
    customers,
    customerSummary: {
      total: customers.length,
      regulars: customers.filter((c) => c.segment === 'regular').length,
      dormant: customers.filter((c) => c.segment === 'dormant').length,
      reachableOnWhatsApp: customers.filter((c) => c.whatsappOptIn && c.phone).length,
    },
    recentActions,
    learning: merchant.learning || {},
  };

  log.info('agent:observe', `snapshot for ${merchantId}: ${daily.length} days, ${dailyRows.reduce((s, r) => s + r.count, 0)} txns, ${customers.length} customers`);
  return snapshot;
}

module.exports = { buildSnapshot, fillDays };
