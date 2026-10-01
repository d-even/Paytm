// analyze_sales_trend() — pure function over the Observe snapshot.
// Finds (1) a weekday that is consistently weaker than the rest of the week and
// (2) week-over-week momentum. Every finding carries the numbers that justify it.
const { DAY_NAMES } = require('../../utils/time');

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const round = (x) => Math.round(x);
const pct = (x) => Math.round(x * 1000) / 10; // 0.1834 → 18.3

function nextOccurrence(weekday, todayKey, todayWeekday) {
  const delta = (weekday - todayWeekday + 7) % 7;
  const d = new Date(`${todayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function analyzeSalesTrend({ daily, todayKey, todayWeekday }, opts = {}) {
  const minDipPct = opts.minDipPct ?? 0.12;
  const minOccurrences = opts.minOccurrences ?? 3;
  const findings = [];

  // Only complete days count — today is still in progress.
  const days = daily.filter((d) => d.dayKey < todayKey);
  if (days.length < 14) return { findings, stats: { daysObserved: days.length } };

  // 1) Recurring weekday dip ------------------------------------------------
  let worst = null;
  for (let w = 0; w < 7; w += 1) {
    const same = days.filter((d) => d.weekday === w);
    const others = days.filter((d) => d.weekday !== w && d.total > 0);
    if (same.length < minOccurrences || !others.length) continue;
    const avgW = mean(same.map((d) => d.total));
    const avgOthers = mean(others.map((d) => d.total));
    const dipPct = (avgOthers - avgW) / avgOthers;
    const recent = same.slice(-4);
    const weakWeeks = recent.filter((d) => d.total < avgOthers).length;
    if (dipPct >= minDipPct && weakWeeks >= Math.min(3, recent.length) && (!worst || dipPct > worst.dipPct)) {
      worst = { weekday: w, avgW, avgOthers, dipPct, weakWeeks, occurrences: recent.map((d) => ({ day: d.dayKey, total: round(d.total) })) };
    }
  }
  if (worst) {
    findings.push({
      id: `weekday-dip-${worst.weekday}`,
      type: 'SALES_DIP',
      severity: 'opportunity',
      title: `${DAY_NAMES[worst.weekday]} sales run ${pct(worst.dipPct)}% below the rest of the week`,
      confidence: Math.min(0.95, 0.55 + worst.dipPct + 0.05 * worst.weakWeeks),
      evidence: {
        weekday: worst.weekday,
        weekdayName: DAY_NAMES[worst.weekday],
        avgOnWeekday: round(worst.avgW),
        avgOtherDays: round(worst.avgOthers),
        dipPct: pct(worst.dipPct),
        weeksBelowAverage: worst.weakWeeks,
        weeksObserved: worst.occurrences.length,
        lastOccurrences: worst.occurrences,
        targetDate: nextOccurrence(worst.weekday, todayKey, todayWeekday),
      },
      // Tools decide WHAT kind of action fits; the LLM only writes the words.
      proposedAction: { kind: 'WHATSAPP_OFFER', family: 'marketing', riskTier: 'low', audience: 'regulars' },
    });
  }

  // 2) Week-over-week momentum ---------------------------------------------
  const last7 = days.slice(-7).reduce((s, d) => s + d.total, 0);
  const prior7 = days.slice(-14, -7).reduce((s, d) => s + d.total, 0);
  if (prior7 > 0) {
    const change = (last7 - prior7) / prior7;
    if (Math.abs(change) >= 0.1) {
      findings.push({
        id: change > 0 ? 'wow-growth' : 'wow-decline',
        type: change > 0 ? 'SALES_GROWTH' : 'SALES_DIP',
        severity: change > 0 ? 'info' : 'warning',
        title: `Sales ${change > 0 ? 'up' : 'down'} ${pct(Math.abs(change))}% vs the previous week`,
        confidence: Math.min(0.9, 0.5 + Math.abs(change)),
        evidence: { last7Days: round(last7), previous7Days: round(prior7), changePct: pct(change) },
        proposedAction: null, // informational — goes into the briefing/dashboard only
      });
    }
  }

  // Yesterday vs the same weekday last week (used by the daily briefing).
  const y = days[days.length - 1];
  const lastWeekSame = days[days.length - 8]; // days are contiguous (Observe fills gaps with 0)
  const stats = {
    daysObserved: days.length,
    yesterday: { day: y.dayKey, weekday: y.weekday, total: round(y.total), count: y.count },
    yesterdayVsLastWeekPct: lastWeekSame && lastWeekSame.total ? pct((y.total - lastWeekSame.total) / lastWeekSame.total) : null,
    avgDaily: round(mean(days.map((d) => d.total))),
  };
  return { findings, stats };
}

module.exports = { analyzeSalesTrend, nextOccurrence };
