// recognize_customer() — the complementary POS/RFID signal. Runs the moment a card
// is tapped, while the customer is still at the counter.
function recognizeCustomer({ customer, prevLastSeen, now }, { regularVisitThreshold, dormantAfterDays }) {
  if (!customer) return null;
  const gapDays = prevLastSeen ? (now - new Date(prevLastSeen)) / 864e5 : null;

  if (customer.visitCount > regularVisitThreshold && gapDays !== null && gapDays > dormantAfterDays) {
    return {
      reason: 'lapsed-regular-returned',
      visitCount: customer.visitCount,
      gapDays: Math.round(gapDays),
      discountPct: 10,
      confidence: 0.85,
    };
  }
  if (customer.visitCount >= regularVisitThreshold) {
    return { reason: 'regular', visitCount: customer.visitCount, discountPct: customer.visitCount >= 15 ? 10 : 5, confidence: 0.9 };
  }
  return null; // new/occasional customers: stay quiet, don't clutter the counter
}

module.exports = { recognizeCustomer };
