process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('../src/agent/decide');

const merchant = (trust = {}, extra = {}) => ({
  settings: { trust: { marketing: 'auto', loyalty: 'auto', restock: 'recommend', credit: 'recommend', ...trust }, quietHours: { start: 21, end: 8 }, maxAutoMessagesPerDay: 100, ...extra },
});
const ctx = (o = {}) => ({ now: new Date('2026-09-29T11:00:00+05:30'), localHour: 11, recentActions: [], learning: {}, autoMessagesToday: 0, ...o });
const offer = (o = {}) => ({ kind: 'WHATSAPP_OFFER', family: 'marketing', riskTier: 'low', confidence: 0.8, customerFacing: true, recipientCount: 40, ...o });

test('low-risk marketing auto-executes when merchant allows it', () => {
  assert.equal(decide(offer(), merchant(), ctx()).mode, 'auto');
});

test('credit is ALWAYS recommend-only, even if settings say auto', () => {
  const d = decide({ kind: 'CREDIT_OFFER', family: 'credit', riskTier: 'high', confidence: 0.99 }, merchant({ credit: 'auto' }), ctx());
  assert.equal(d.mode, 'recommend');
  assert.equal(d.trace.at(-1).rule, 'risk-lock');
});

test('merchant preference "recommend" is respected', () => {
  assert.equal(decide(offer(), merchant({ marketing: 'recommend' }), ctx()).mode, 'recommend');
});

test('family switched off → skip', () => {
  assert.equal(decide(offer(), merchant({ marketing: 'off' }), ctx()).mode, 'skip');
});

test('low confidence → ask the merchant first', () => {
  assert.equal(decide(offer({ confidence: 0.4 }), merchant(), ctx()).mode, 'recommend');
});

test('quiet hours → no auto WhatsApp at night', () => {
  const d = decide(offer(), merchant(), ctx({ localHour: 22 }));
  assert.equal(d.mode, 'recommend');
  assert.equal(d.trace.at(-1).rule, 'quiet-hours');
});

test('daily message cap', () => {
  assert.equal(decide(offer(), merchant(), ctx({ autoMessagesToday: 80 })).mode, 'recommend');
});

test('cooldown prevents repeating the same offer within 72h', () => {
  const recent = [{ kind: 'WHATSAPP_OFFER', status: 'executed', createdAt: new Date('2026-09-28T11:00:00+05:30') }];
  assert.equal(decide(offer(), merchant(), ctx({ recentActions: recent })).mode, 'skip');
});

test('poor track record downgrades auto → recommend (Learn feeds Decide)', () => {
  const d = decide(offer(), merchant(), ctx({ learning: { WHATSAPP_OFFER: { tried: 4, positive: 1 } } }));
  assert.equal(d.mode, 'recommend');
  assert.equal(d.trace.at(-1).rule, 'track-record');
});

test('real-time loyalty nudges have no cooldown', () => {
  const recent = [{ kind: 'LOYALTY_NUDGE', status: 'executed', createdAt: new Date() }];
  const d = decide({ kind: 'LOYALTY_NUDGE', family: 'loyalty', riskTier: 'low', confidence: 0.9 }, merchant(), ctx({ recentActions: recent }));
  assert.equal(d.mode, 'auto');
});
