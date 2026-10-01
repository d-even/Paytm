// suggest_reorder() — items that will run out soon at the current selling pace.
// Velocity comes from itemised bills (last 7 days); stock from merchant.inventory.
function findLowStock({ itemUnits, merchant }, opts = {}) {
  const alertDays = opts.alertDays ?? 5;   // flag anything with less than this many days left
  const coverDays = opts.coverDays ?? 14;  // reorder enough for this many days
  const inventory = merchant?.inventory || [];

  const low = inventory
    .map((inv) => {
      const perDay = (itemUnits[inv.name]?.last7 || 0) / 7;
      if (!(perDay > 0) || !(inv.stock >= 0)) return null;
      const daysLeft = inv.stock / perDay;
      if (daysLeft >= alertDays) return null;
      const packSize = inv.packSize || 1;
      const packs = Math.max(1, Math.ceil((perDay * coverDays - inv.stock) / packSize));
      return {
        item: inv.name,
        stock: inv.stock,
        unitsPerDay: Math.round(perDay * 10) / 10,
        daysLeft: Math.round(daysLeft * 10) / 10,
        packs,
        packLabel: inv.packLabel || `${packSize} units`,
        cost: Math.round(packs * (inv.packCost || packSize * (inv.price || 0) * 0.8)),
        // Sales protected: what ~3 days of empty shelf would have cost.
        salesAtRisk: Math.round(perDay * 3 * (inv.price || 0)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  if (!low.length) return { findings: [] };

  const totalCost = low.reduce((s, i) => s + i.cost, 0);
  const salesAtRisk = low.reduce((s, i) => s + i.salesAtRisk, 0);
  return {
    findings: [{
      id: 'low-stock',
      type: 'LOW_STOCK',
      severity: 'warning',
      title: `${low.map((i) => i.item).slice(0, 2).join(' and ')}${low.length > 2 ? ` +${low.length - 2} more` : ''} running low`,
      confidence: Math.min(0.9, 0.6 + (alertDays - low[0].daysLeft) * 0.06),
      evidence: { items: low, totalCost, salesAtRisk, coverDays },
      proposedAction: { kind: 'RESTOCK_ALERT', family: 'restock', riskTier: 'medium', audience: 'merchant' },
    }],
  };
}

module.exports = { findLowStock };
