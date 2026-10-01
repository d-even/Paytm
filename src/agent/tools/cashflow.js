// forecast_cashflow() — 14-day cash forecast from the merchant's own settlements.
//   inflow  = average takings for that weekday over the observed weeks
//   outflow = cost of goods (share of inflow) + fixed daily costs + known bills on their due date
// It's an estimate, and says so: the agent uses it to warn early, never to move money.
function forecastCashflow({ daily, todayKey, merchant, now = new Date() }, opts = {}) {
  const horizon = opts.days ?? 14;
  const cf = merchant?.cashflow || {};
  const cogsPct = cf.cogsPct ?? 0.75;
  const fixed = cf.dailyFixedCost ?? 0;
  const safetyThreshold = cf.safetyThreshold ?? 5000;

  const complete = daily.filter((d) => d.dayKey < todayKey);
  const byWeekday = Array.from({ length: 7 }, (_, w) => {
    const same = complete.filter((d) => d.weekday === w);
    return same.length ? same.reduce((s, d) => s + d.total, 0) / same.length : 0;
  });

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let balance = cf.openingBalance ?? 0;
  const days = [];
  for (let i = 0; i < horizon; i += 1) {
    const date = new Date(start.getTime() + i * 864e5);
    const inflow = Math.round(byWeekday[date.getDay()]);
    const bills = (cf.payables || [])
      .filter((p) => p.dueDate && new Date(p.dueDate).toDateString() === date.toDateString())
      .reduce((s, p) => s + p.amount, 0);
    const outflow = Math.round(inflow * cogsPct + fixed + bills);
    balance += inflow - outflow;
    days.push({ date: date.toISOString(), inflow, outflow, balance: Math.round(balance), bills });
  }
  const shortfallDayIndex = days.findIndex((d) => d.balance < safetyThreshold);
  const lowest = days.reduce((m, d) => (d.balance < m.balance ? d : m), days[0]);
  return { days, shortfallDayIndex, safetyThreshold, lowest, gap: Math.max(0, safetyThreshold - lowest.balance) };
}

module.exports = { forecastCashflow };
