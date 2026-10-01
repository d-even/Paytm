// npm run seed — loads 4 weeks of realistic demo data for Ramesh General Store.
// Safe to re-run: it wipes and rebuilds only this merchant's data.
const { connectDB, disconnectDB } = require('../src/config/db');
const { Merchant, Transaction, CustomerProfile, AgentInsight, AgentAction, ChannelMessage } = require('../src/models');
const { segmentFor } = require('../src/services/customerService');
const { buildDemoData } = require('./lib/demoData');

async function seed({ now = new Date() } = {}) {
  const data = buildDemoData({ now });
  const { merchantId } = data.merchant;

  await Promise.all([Merchant, Transaction, CustomerProfile, AgentInsight, AgentAction, ChannelMessage]
    .map((M) => M.deleteMany({ merchantId })));

  await Merchant.create(data.merchant);
  await Transaction.insertMany(data.transactions, { ordered: false });
  await CustomerProfile.insertMany(data.profiles.map((p) => ({ ...p, segment: segmentFor(p, now) })));
  return data;
}

if (require.main === module) {
  (async () => {
    await connectDB();
    const data = await seed();
    const total = data.transactions.reduce((s, t) => s + t.amount, 0);
    console.log(`\n✅ Seeded ${data.merchant.name} (${data.merchant.merchantId})`);
    console.log(`   ${data.transactions.length} transactions over 28 days · ₹${total.toLocaleString('en-IN')} GMV · ${data.profiles.length} customers`);
    if (!process.argv.includes('--no-agent')) {
      // One agent cycle now, so the app opens with real insights, an auto-sent offer and approvals waiting.
      const { runCycle } = require('../src/agent');
      const out = await runCycle(data.merchant.merchantId);
      console.log(`   First agent run: ${out.insightsCreated} insights, ${out.actions.length} actions (${out.actions.map((a) => `${a.kind}:${a.status}`).join(', ')})`);
    }
    console.log(`   RFID cards: Sharma ji = ${data.cards.SHARMA.rfidUid} (regular), Gupta ji = ${data.cards.GUPTA.rfidUid} (lapsed regular)`);
    console.log('\nNext:  npm run dev  → start the API + scheduler, then call it (see README), or  npm run simulate  for the full scripted demo.\n');
    await disconnectDB();
  })().catch(async (err) => { console.error(err); await disconnectDB(); process.exit(1); });
}

module.exports = { seed };
