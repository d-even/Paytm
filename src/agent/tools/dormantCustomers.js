// find_dormant_regulars() — regulars who have stopped coming. Built from hashed UPI
// identities, so it works without any loyalty card or hardware.
function findDormantRegulars({ customers, now }, { regularVisitThreshold, dormantAfterDays }) {
  const dormant = customers.filter((c) => {
    const days = c.lastSeen ? (now - new Date(c.lastSeen)) / 864e5 : Infinity;
    return c.visitCount >= regularVisitThreshold && days > dormantAfterDays;
  });
  if (!dormant.length) return { findings: [] };

  const reachable = dormant.filter((c) => c.whatsappOptIn && c.phone);
  const avgSpend = dormant.reduce((s, c) => s + c.totalSpend / c.visitCount, 0) / dormant.length;
  return {
    findings: [{
      id: 'dormant-regulars',
      type: 'DORMANT_REGULARS',
      severity: 'opportunity',
      title: `${dormant.length} regular customer${dormant.length > 1 ? 's have' : ' has'} not visited in over ${dormantAfterDays} days`,
      confidence: Math.min(0.9, 0.5 + dormant.length * 0.05),
      evidence: {
        dormantCount: dormant.length,
        reachableOnWhatsApp: reachable.length,
        avgTicket: Math.round(avgSpend),
        sample: dormant.slice(0, 5).map((c) => ({ customer: c.displayName || c.payerMasked, visits: c.visitCount, lastSeen: c.lastSeen })),
      },
      proposedAction: reachable.length
        ? { kind: 'WINBACK_MESSAGE', family: 'marketing', riskTier: 'low', audience: 'dormant' }
        : null,
    }],
  };
}

module.exports = { findDormantRegulars };
