// Tests for the features added for the React app: reorder, cash forecast, session tokens, trust mapping.
const test = require('node:test');
const assert = require('node:assert');
const { buildDemoData } = require('../scripts/lib/demoData');
const { snapshotFromData } = require('./helpers/snapshotFromData');
const tools = require('../src/agent/tools');
const { collectFindings } = require('../src/agent/reason');
const { issueToken, verifyToken } = require('../src/middleware/appAuth');
const { trustView } = require('../src/services/appViews');

const now = new Date('2026-09-30T11:00:00+05:30');
const snap = snapshotFromData(buildDemoData({ now }), now);

test('findLowStock: sugar and oil flagged with a costed reorder', () => {
  const [f] = tools.findLowStock(snap).findings;
  assert.ok(f, 'expected a LOW_STOCK finding');
  assert.equal(f.proposedAction.kind, 'RESTOCK_ALERT');
  const names = f.evidence.items.map((i) => i.item).sort();
  assert.deepEqual(names, ['Cheeni 1kg', 'Cooking oil 1L']);
  for (const i of f.evidence.items) {
    assert.ok(i.daysLeft < 5 && i.packs >= 1 && i.cost > 0);
  }
  assert.equal(f.evidence.totalCost, f.evidence.items.reduce((s, i) => s + i.cost, 0));
});

test('only one RESTOCK_ALERT is proposed per cycle (slow movers are informational)', () => {
  const { findings } = collectFindings(snap);
  assert.equal(findings.filter((f) => f.proposedAction?.kind === 'RESTOCK_ALERT').length, 1);
});

test('forecastCashflow: 14 days, supplier bill causes a shortfall before day 7', () => {
  const f = tools.forecastCashflow({ ...snap, now });
  assert.equal(f.days.length, 14);
  assert.ok(f.shortfallDayIndex >= 0 && f.shortfallDayIndex <= 6, `shortfall at ${f.shortfallDayIndex}`);
  assert.ok(f.days[6].outflow > f.days[5].outflow, 'bill day has the big outflow');
  assert.ok(f.gap > 0);
});

test('app session token: round-trips, rejects tampering and expiry', () => {
  const t = issueToken('MID-RAMESH-001', 1000);
  assert.equal(verifyToken(t, 2000), 'MID-RAMESH-001');
  assert.equal(verifyToken(`${t.slice(0, -2)}00`, 2000), null);
  assert.equal(verifyToken(t, 1000 + 8 * 24 * 3600 * 1000), null);
  assert.equal(verifyToken('garbage', 2000), null);
});

test('trust settings map agent families to app vocabulary; loans stay recommend-only', () => {
  const v = trustView({ settings: { trust: { marketing: 'auto', loyalty: 'recommend', restock: 'off', credit: 'recommend' }, campaignSpendCap: 800, undoWindowMinutes: 60 } });
  assert.deepEqual(v.modes, { marketing: 'auto', pricing: 'ask', reorder: 'off', loan: 'recommend_only' });
  assert.equal(v.campaignSpendCap, 800);
  assert.equal(v.undoWindowMinutes, 60);
});
