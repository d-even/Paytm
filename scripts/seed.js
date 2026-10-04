// npm run seed       → a clean start for Deven General Store: the shop + two card customers
//                      (Chinu, Shravni Chavan). No sales: History, Impact and Regulars fill up
//                      from real payments made at the counter.
// npm run seed:demo  → the same shop PLUS 28 days of synthetic sales, so the agent has patterns to
//                      find (slow Tuesdays, lapsed regulars...). For pitches; not real data.
// Safe to re-run: it wipes and rebuilds only this shop's data (and the old "Ramesh" shop's).
const { connectDB, disconnectDB } = require('../src/config/db');
const { Merchant, Transaction, CustomerProfile, AgentInsight, AgentAction, ChannelMessage, Checkout } = require('../src/models');
const { segmentFor } = require('../src/services/customerService');
const { buildBaseData, buildDemoData, LEGACY_MERCHANT_IDS } = require('./lib/demoData');

async function seed({ now = new Date(), demo = false } = {}) {
  const data = demo ? buildDemoData({ now }) : buildBaseData();
  const { merchantId } = data.merchant;

  await Promise.all([Merchant, Transaction, CustomerProfile, AgentInsight, AgentAction, ChannelMessage, Checkout]
    .map((M) => M.deleteMany({ merchantId: { $in: [merchantId, ...LEGACY_MERCHANT_IDS] } })));

  await Merchant.create(data.merchant);
  if (data.transactions.length) await Transaction.insertMany(data.transactions, { ordered: false });
  await CustomerProfile.insertMany(data.profiles.map((p) => ({ ...p, segment: segmentFor(p, now) })));
  return data;
}

if (require.main === module) {
  (async () => {
    const demo = process.argv.includes('--demo');
    await connectDB();
    const data = await seed({ demo });
    console.log(`\n✅ Seeded ${data.merchant.name} (${data.merchant.merchantId}) · owner phone ${data.merchant.phone}`);
    if (demo) {
      const total = data.transactions.reduce((s, t) => s + t.amount, 0);
      console.log(`   DEMO DATA: ${data.transactions.length} synthetic transactions over 28 days · ₹${total.toLocaleString('en-IN')} GMV · ${data.profiles.length} customers`);
      // One agent cycle now, so the app opens with insights, an auto-sent offer and approvals waiting.
      const { runCycle } = require('../src/agent');
      const out = await runCycle(data.merchant.merchantId);
      console.log(`   First agent run: ${out.insightsCreated} insights, ${out.actions.length} actions (${out.actions.map((a) => `${a.kind}:${a.status}`).join(', ')})`);
    } else {
      console.log('   Clean start: no sales yet. Everything in the app is built from real payments from now on.');
    }
    for (const c of Object.values(data.cards)) console.log(`   Card customer: ${c.name} · card ${c.rfidUid} · WhatsApp ${c.phone}`);
    console.log('\n   Using your own RFID cards? Put their UIDs in .env (CARD_UID_CHINU / CARD_UID_SHRAVNI), re-run this seed,');
    console.log('   or tap a new card with no bill open and link it to a customer on the Counter screen.');
    console.log('\nNext:  npm start  → open http://localhost:4000\n');
    await disconnectDB();
  })().catch(async (err) => { console.error(err); await disconnectDB(); process.exit(1); });
}

module.exports = { seed };
