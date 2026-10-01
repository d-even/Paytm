// flag_credit_opportunity() — settlement stability → indicative credit eligibility.
// This NEVER applies for a loan. It produces a recommend-only nudge; the lending
// partner makes the real underwriting decision.
function assessCredit({ daily, todayKey }, opts = {}) {
  const minMonthlyGmv = opts.minMonthlyGmv ?? 50000;
  const days = daily.filter((d) => d.dayKey < todayKey).slice(-28);
  if (days.length < 28) return { findings: [] };

  const weeks = [0, 1, 2, 3].map((i) => days.slice(i * 7, i * 7 + 7).reduce((s, d) => s + d.total, 0));
  const meanW = weeks.reduce((s, x) => s + x, 0) / 4;
  const sd = Math.sqrt(weeks.reduce((s, x) => s + (x - meanW) ** 2, 0) / 4);
  const cv = meanW ? sd / meanW : 1;
  const activeRatio = days.filter((d) => d.total > 0).length / days.length;
  const monthlyGmv = (weeks.reduce((s, x) => s + x, 0) * 30) / 28;

  const eligible = activeRatio >= 0.8 && cv <= 0.25 && monthlyGmv >= minMonthlyGmv;
  if (!eligible) return { findings: [], stats: { cv, activeRatio, monthlyGmv } };

  const score = Math.round(100 * (0.5 * activeRatio + 0.5 * (1 - Math.min(cv / 0.25, 1))));
  const limit = Math.min(500000, Math.floor((monthlyGmv * 0.18) / 5000) * 5000);
  return {
    findings: [{
      id: 'credit-eligible',
      type: 'CREDIT_ELIGIBLE',
      severity: 'opportunity',
      title: `Stable settlements — indicatively eligible for a business loan up to ₹${limit.toLocaleString('en-IN')}`,
      confidence: Math.min(0.9, 0.4 + score / 200),
      evidence: {
        monthlyGmv: Math.round(monthlyGmv),
        weeklyTotals: weeks.map(Math.round),
        weeklyVariationPct: Math.round(cv * 1000) / 10,
        activeDaysPct: Math.round(activeRatio * 100),
        stabilityScore: score,
        indicativeLimit: limit,
        note: 'Indicative only — final eligibility is decided by the lending partner.',
      },
      proposedAction: { kind: 'CREDIT_OFFER', family: 'credit', riskTier: 'high', audience: 'merchant' },
    }],
  };
}

module.exports = { assessCredit };
