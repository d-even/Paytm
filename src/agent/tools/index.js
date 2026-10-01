// Tool layer — deterministic analytics the agent reasons over. They own the FACTS;
// the LLM only prioritises and phrases them; the trust engine owns PERMISSION.
module.exports = {
  ...require('./salesTrend'),
  ...require('./dormantCustomers'),
  ...require('./creditEligibility'),
  ...require('./slowMovers'),
  ...require('./lowStock'),
  ...require('./cashflow'),
  ...require('./realtimeRecognition'),
};
