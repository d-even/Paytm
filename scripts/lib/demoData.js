// Seed data for "Deven General Store, Mumbai". Pure functions (no DB), so the same data powers
// `npm run seed` AND the unit tests. Two builders:
//
//   buildBaseData()  → the shop + two named card customers (Chinu, Shravni Chavan) and NOTHING else.
//                      This is what `npm run seed` loads: History, Impact and every number in the app
//                      then come from real payments made at your counter.
//   buildDemoData()  → the same, plus 28 days of synthetic sales so the agent has patterns to find
//                      (`npm run seed:demo`). Useful for a pitch; not real data.
//
// Built-in patterns the agent should discover on its own:
//   • Tuesdays run ~18% below other days            → SALES_DIP  → WhatsApp offer
//   • 8 regulars stopped coming ~3 weeks ago         → DORMANT_REGULARS → win-back
//   • 4 steady weeks, ~₹2.9L/month                   → CREDIT_ELIGIBLE (recommend-only)
//   • Detergent sales fell sharply this week         → SLOW_MOVER → restock alert
const { hashIdentity, maskVpa, maskUid } = require('../../src/utils/crypto');
const { localParts } = require('../../src/utils/time');
const config = require('../../src/config');

const MERCHANT = {
  merchantId: 'MID-DEVEN-001',
  name: 'Deven General Store',
  ownerName: 'Deven',
  category: 'kirana',
  city: 'Mumbai',
  phone: '+918928877124', // the shop owner's number (the POS owner)
  language: 'hi-IN',
  soundboxDeviceId: 'SB-DEVEN-01',
  // The ESP32 firmware's DEVICE_ID. Renaming it means changing config.h and POS_DEVICE_SECRETS too.
  posDeviceIds: ['POS-RAMESH-01'],
  settings: {
    // Deven has pre-approved low-risk marketing to auto-send (as in the demo story).
    trust: { marketing: 'auto', loyalty: 'auto', restock: 'recommend', credit: 'recommend' },
    dailyBriefing: true,
    maxAutoMessagesPerDay: 100,
    // Wide-open quiet hours so the demo auto-sends whatever time you run it.
    quietHours: { start: 0, end: 0 },
  },
};

const ITEMS = [
  { name: 'Chai patti 250g', price: 120, weight: 10 },
  { name: 'Biscuit packet', price: 30, weight: 14 },
  { name: 'Doodh 500ml', price: 33, weight: 16 },
  { name: 'Atta 5kg', price: 260, weight: 5 },
  { name: 'Cheeni 1kg', price: 48, weight: 8 },
  { name: 'Namak 1kg', price: 28, weight: 4 },
  { name: 'Noodles', price: 14, weight: 9 },
  { name: 'Cooking oil 1L', price: 160, weight: 5 },
  { name: 'Detergent 1kg', price: 110, weight: 6 },
  { name: 'Sabun', price: 40, weight: 6 },
];

// Merchants this seed replaces. The shop used to be called "Ramesh"; its data is wiped on re-seed.
const LEGACY_MERCHANT_IDS = ['MID-RAMESH-001'];

// The shop's two card customers. Both get WhatsApp offers on the same test phone (9321796361),
// so one phone is enough to see every message. Their card UIDs come from .env (CARD_UID_*),
// falling back to the virtual cards behind the app's "Tap card" button.
const CUSTOMER_PHONE = '+919321796361';
const CHINU = { vpa: 'chinu@paytm', rfidUid: config.cards.chinu, name: 'Chinu', phone: CUSTOMER_PHONE };
const SHRAVNI = { vpa: 'shravni.chavan@okaxis', rfidUid: config.cards.shravni, name: 'Shravni Chavan', phone: CUSTOMER_PHONE };
const CARD_CUSTOMERS = [CHINU, SHRAVNI];

// The part of a customer profile that comes from knowing who they are, not from payments.
function identityFields(c) {
  return {
    customerKey: hashIdentity('upi', c.vpa),
    aliases: [hashIdentity('rfid', c.rfidUid)],
    cardsMasked: [maskUid(c.rfidUid)],
    displayName: c.name,
    payerMasked: maskVpa(c.vpa),
    phone: c.phone,
    whatsappOptIn: true,
  };
}

// Tiny seeded PRNG (mulberry32) → identical data on every run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(r, list) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let x = r() * total;
  for (const it of list) { x -= it.weight; if (x <= 0) return it; }
  return list[list.length - 1];
}

function buildDemoData({ now = new Date(), days = 28, seed = 42 } = {}) {
  const r = rng(seed);
  const regulars = [CHINU];
  for (let i = 1; i < 40; i += 1) regulars.push({ vpa: `regular${i}@paytm`, phone: `+9198000${String(1000 + i).padStart(5, '0')}`, name: null });
  const dormant = [SHRAVNI];
  for (let i = 1; i < 8; i += 1) dormant.push({ vpa: `old${i}@ybl`, phone: `+9198001${String(1000 + i).padStart(5, '0')}`, name: null });
  const occasional = Array.from({ length: 150 }, (_, i) => ({ vpa: `walkin${i}@upi` }));

  const transactions = [];
  for (let d = days; d >= 1; d -= 1) {
    const { dayKey } = localParts(new Date(now.getTime() - d * 864e5));
    const { weekday } = localParts(new Date(`${dayKey}T12:00:00+05:30`));
    const isTuesday = weekday === 2;
    const target = (isTuesday ? 8400 : 10200) * (0.96 + r() * 0.08);
    const lastWeek = d <= 7;

    let total = 0; let n = 0;
    while (total < target) {
      // Who is paying?
      let who;
      const roll = r();
      if (roll < 0.55) who = regulars[Math.floor(r() * regulars.length)];
      else if (roll < 0.75 && d > 20) who = dormant[Math.floor(r() * dormant.length)]; // dormant ones only early on
      else who = occasional[Math.floor(r() * occasional.length)];

      // What did they buy?
      const lines = [];
      const count = 1 + Math.floor(r() * 3);
      for (let k = 0; k < count; k += 1) {
        let it = pickWeighted(r, ITEMS);
        if (it.name === 'Detergent 1kg' && lastWeek && r() < 0.8) it = ITEMS[1]; // slow mover this week
        const qty = 1 + (r() < 0.25 ? 1 : 0);
        lines.push({ name: it.name, qty, price: it.price });
      }
      const amount = lines.reduce((s, l) => s + l.qty * l.price, 0);

      // When? 7am–10pm IST, heavier in the evening.
      const hour = r() < 0.45 ? 17 + Math.floor(r() * 4) : 7 + Math.floor(r() * 15);
      const minute = Math.floor(r() * 60);
      const settledAt = new Date(`${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);

      n += 1;
      total += amount;
      transactions.push({
        txnId: `SEED${dayKey.replace(/-/g, '')}${String(n).padStart(4, '0')}`,
        merchantId: MERCHANT.merchantId,
        amount,
        channel: r() < 0.9 ? 'UPI' : 'QR',
        source: 'upi',
        status: 'SETTLED',
        customerKey: hashIdentity('upi', who.vpa),
        payerMasked: maskVpa(who.vpa),
        items: lines,
        settledAt,
      });
    }
  }

  // Customer profiles derived from the transactions (what the gateway would have built).
  const byKey = new Map();
  for (const t of transactions) {
    const p = byKey.get(t.customerKey) || { visitCount: 0, totalSpend: 0, firstSeen: t.settledAt, lastSeen: t.settledAt, payerMasked: t.payerMasked };
    p.visitCount += 1; p.totalSpend += t.amount;
    if (t.settledAt < p.firstSeen) p.firstSeen = t.settledAt;
    if (t.settledAt > p.lastSeen) p.lastSeen = t.settledAt;
    byKey.set(t.customerKey, p);
  }
  const optIn = new Map([...regulars, ...dormant].map((c) => [hashIdentity('upi', c.vpa), c]));
  const profiles = [...byKey.entries()].map(([customerKey, p]) => {
    const c = optIn.get(customerKey);
    const named = CARD_CUSTOMERS.includes(c) ? identityFields(c) : {};
    return {
      merchantId: MERCHANT.merchantId, customerKey, aliases: [], payerMasked: p.payerMasked,
      displayName: c?.name || undefined,
      phone: c?.phone, whatsappOptIn: Boolean(c),
      ...named,
      visitCount: p.visitCount, totalSpend: p.totalSpend, firstSeen: p.firstSeen, lastSeen: p.lastSeen,
    };
  });

  // Shelf stock: sugar and oil are nearly out (→ LOW_STOCK reorder), everything else is fine.
  const weekAgo = now.getTime() - 7 * 864e5;
  const sold7 = {};
  for (const t of transactions) {
    if (t.settledAt.getTime() < weekAgo) continue;
    for (const l of t.items) sold7[l.name] = (sold7[l.name] || 0) + l.qty;
  }
  const COVER_DAYS = { 'Cheeni 1kg': 1.8, 'Cooking oil 1L': 2.6 };
  const PACKS = { 'Cheeni 1kg': ['25 kg bag', 25], 'Cooking oil 1L': ['15 L tin', 15], 'Atta 5kg': ['10 bags', 10] };
  const inventory = ITEMS.map((it) => {
    const perDay = (sold7[it.name] || 0) / 7;
    const [packLabel, packSize] = PACKS[it.name] || [`case of 24`, 24];
    return {
      name: it.name, price: it.price, packLabel, packSize, packCost: Math.round(it.price * 0.8 * packSize),
      stock: Math.round(perDay * (COVER_DAYS[it.name] ?? 18)),
    };
  });

  // Cash forecast inputs: a supplier bill lands in 6 days, before the weekend takings.
  const dueDate = new Date(now.getTime() + 6 * 864e5);
  const cashflow = {
    openingBalance: 9000, cogsPct: 0.74, dailyFixedCost: 700, safetyThreshold: 5000,
    payables: [{ label: 'Supplier payment (wholesaler)', amount: 24000, dueDate }],
  };

  return { merchant: { ...MERCHANT, inventory, cashflow }, transactions, profiles, cards: { CHINU, SHRAVNI } };
}

// The clean start: the shop and its two card customers, no sales, no stock, no bills due.
// Nothing here is made up except who the customers are; every rupee shown later is a real payment.
function buildBaseData() {
  const merchant = {
    ...MERCHANT,
    inventory: [],
    cashflow: { openingBalance: 0, cogsPct: 0.74, dailyFixedCost: 0, safetyThreshold: 0, payables: [] },
  };
  const profiles = CARD_CUSTOMERS.map((c) => ({
    merchantId: merchant.merchantId, ...identityFields(c), visitCount: 0, totalSpend: 0, segment: 'new',
  }));
  return { merchant, transactions: [], profiles, cards: { CHINU, SHRAVNI } };
}

module.exports = { buildDemoData, buildBaseData, MERCHANT, LEGACY_MERCHANT_IDS, CHINU, SHRAVNI, CARD_CUSTOMERS, ITEMS };
