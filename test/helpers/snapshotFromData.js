// Builds the same snapshot shape Observe produces, but in plain JS (no MongoDB),
// so the agent's Reason/Decide logic can be unit-tested against the demo data.
const { localParts, startOfLocalDay, daysAgo } = require('../../src/utils/time');
const { fillDays } = require('../../src/agent/observe');
const { segmentFor } = require('../../src/services/customerService');

function snapshotFromData({ merchant, transactions, profiles }, now = new Date()) {
  const since = startOfLocalDay(daysAgo(28, now), 'Asia/Kolkata');
  const byDay = new Map();
  for (const t of transactions) {
    if (t.settledAt < since) continue;
    const k = localParts(t.settledAt).dayKey;
    const row = byDay.get(k) || { _id: k, total: 0, count: 0 };
    row.total += t.amount; row.count += 1;
    byDay.set(k, row);
  }
  const last7 = daysAgo(7, now);
  const itemUnits = {};
  for (const t of transactions) {
    for (const it of t.items) {
      const u = itemUnits[it.name] || { last7: 0, prior21: 0 };
      if (t.settledAt >= last7) u.last7 += it.qty; else u.prior21 += it.qty;
      itemUnits[it.name] = u;
    }
  }
  const customers = profiles.map((p) => ({ ...p, segment: segmentFor(p, now) }));
  const today = localParts(now);
  return {
    merchant, now, todayKey: today.dayKey, todayWeekday: today.weekday,
    daily: fillDays([...byDay.values()], since, now, 'Asia/Kolkata'),
    hourly: [], itemUnits, customers,
    customerSummary: {
      total: customers.length,
      regulars: customers.filter((c) => c.segment === 'regular').length,
      dormant: customers.filter((c) => c.segment === 'dormant').length,
      reachableOnWhatsApp: customers.filter((c) => c.whatsappOptIn && c.phone).length,
    },
    recentActions: [], learning: merchant.learning || {},
  };
}

module.exports = { snapshotFromData };
