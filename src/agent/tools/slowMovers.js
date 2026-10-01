// suggest_restock() — items whose weekly units fell sharply vs their recent average.
function findSlowMovers({ itemUnits }, opts = {}) {
  const minDrop = opts.minDrop ?? 0.4;
  const minWeeklyUnits = opts.minWeeklyUnits ?? 5;
  const slow = Object.entries(itemUnits)
    .map(([name, u]) => ({ name, last7: u.last7, priorWeeklyAvg: u.prior21 / 3 }))
    .filter((i) => i.priorWeeklyAvg >= minWeeklyUnits && i.last7 <= i.priorWeeklyAvg * (1 - minDrop))
    .sort((a, b) => a.last7 / a.priorWeeklyAvg - b.last7 / b.priorWeeklyAvg);
  if (!slow.length) return { findings: [] };
  return {
    findings: [{
      id: 'slow-movers',
      type: 'SLOW_MOVER',
      severity: 'info',
      title: `${slow[0].name}${slow.length > 1 ? ` and ${slow.length - 1} more item(s)` : ''} selling much slower this week`,
      confidence: 0.65,
      evidence: {
        items: slow.slice(0, 5).map((i) => ({
          item: i.name, unitsLast7Days: i.last7, usualWeeklyUnits: Math.round(i.priorWeeklyAvg),
          dropPct: Math.round((1 - i.last7 / i.priorWeeklyAvg) * 100),
        })),
      },
      // Informational: the reorder action belongs to findLowStock (one RESTOCK_ALERT per cycle).
      proposedAction: null,
    }],
  };
}

module.exports = { findSlowMovers };
