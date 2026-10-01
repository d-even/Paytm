process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDemoData } = require('../scripts/lib/demoData');
const { snapshotFromData } = require('./helpers/snapshotFromData');
const tools = require('../src/agent/tools');
const { collectFindings, templateCopy } = require('../src/agent/reason');

const NOW = new Date('2026-09-29T15:00:00+05:30'); // a Tuesday afternoon
const snapshot = snapshotFromData(buildDemoData({ now: NOW }), NOW);
const opts = { regularVisitThreshold: 5, dormantAfterDays: 14 };

test('Observe window covers 28 full days + today', () => {
  assert.equal(snapshot.daily.length, 29);
  assert.equal(snapshot.daily.at(-1).dayKey, '2026-09-29');
  assert.ok(snapshot.daily.slice(0, 28).every((d) => d.total > 0));
});

test('analyzeSalesTrend finds the recurring Tuesday dip (~17-18%)', () => {
  const { findings } = tools.analyzeSalesTrend(snapshot);
  const dip = findings.find((f) => f.id === 'weekday-dip-2');
  assert.ok(dip, 'expected a Tuesday dip finding');
  assert.equal(dip.evidence.weekdayName, 'Tuesday');
  assert.ok(dip.evidence.dipPct > 12 && dip.evidence.dipPct < 25, `dipPct=${dip.evidence.dipPct}`);
  assert.equal(dip.evidence.targetDate, '2026-09-29');
  assert.equal(dip.proposedAction.kind, 'WHATSAPP_OFFER');
});

test('findDormantRegulars finds the 8 regulars who stopped coming', () => {
  const { findings } = tools.findDormantRegulars(snapshot, opts);
  assert.equal(findings[0].evidence.dormantCount, 8);
  assert.equal(findings[0].proposedAction.kind, 'WINBACK_MESSAGE');
});

test('assessCredit flags stable settlements as recommend-only credit', () => {
  const { findings } = tools.assessCredit(snapshot);
  assert.equal(findings[0].type, 'CREDIT_ELIGIBLE');
  assert.equal(findings[0].evidence.indicativeLimit, 50000);
  assert.equal(findings[0].proposedAction.riskTier, 'high');
});

test('assessCredit stays silent for erratic sales', () => {
  const erratic = { ...snapshot, daily: snapshot.daily.map((d, i) => ({ ...d, total: i % 3 === 0 ? 0 : d.total * (i % 2 ? 2 : 0.3) })) };
  assert.equal(tools.assessCredit(erratic).findings.length, 0);
});

test('findSlowMovers spots the detergent slowdown', () => {
  const { findings } = tools.findSlowMovers(snapshot);
  assert.equal(findings[0].evidence.items[0].item, 'Detergent 1kg');
});

test('fallback copy is Hinglish, uses only evidence numbers', () => {
  const { findings } = collectFindings(snapshot);
  const dip = findings.find((f) => f.type === 'SALES_DIP');
  const copy = templateCopy(dip, snapshot);
  assert.match(copy.summary, /Mangalwar/);
  assert.ok(copy.summary.includes(String(dip.evidence.dipPct)));
  assert.ok(copy.message.length < 280);
});

test('recognizeCustomer: regular, lapsed regular, and new customer', () => {
  const now = new Date();
  const regular = tools.recognizeCustomer({ customer: { visitCount: 12 }, prevLastSeen: new Date(now - 2 * 864e5), now }, opts);
  assert.equal(regular.reason, 'regular');
  assert.equal(regular.discountPct, 5);
  const lapsed = tools.recognizeCustomer({ customer: { visitCount: 9 }, prevLastSeen: new Date(now - 21 * 864e5), now }, opts);
  assert.equal(lapsed.reason, 'lapsed-regular-returned');
  assert.equal(tools.recognizeCustomer({ customer: { visitCount: 1 }, prevLastSeen: null, now }, opts), null);
});
