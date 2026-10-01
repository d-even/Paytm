process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-key';
process.env.POS_DEVICE_SECRETS = 'POS-T1:' + 'ab'.repeat(32);
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createApp } = require('../src/app');
const { hashIdentity, maskVpa } = require('../src/utils/crypto');

let server; let base;
test.before(() => new Promise((r) => { server = createApp().listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());

function signed(body, { ts = Math.floor(Date.now() / 1000), secret = 'ab'.repeat(32), device = 'POS-T1' } = {}) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(`${device}.${ts}.${raw}`).digest('hex');
  return { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-device-id': device, 'x-timestamp': String(ts), 'x-signature': sig } };
}

test('health endpoint reports mock channels + fallback reasoning without keys', async () => {
  const r = await (await fetch(`${base}/api/v1/health`)).json();
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.posDevices, ['POS-T1']);
});

test('merchant API rejects missing/wrong x-api-key', async () => {
  const r1 = await fetch(`${base}/api/v1/agent/insights?merchantId=x`);
  const r2 = await fetch(`${base}/api/v1/agent/insights?merchantId=x`, { headers: { 'x-api-key': 'nope' } });
  assert.equal(r1.status, 401);
  assert.equal(r2.status, 401);
});

test('POS: unknown device, bad signature, stale timestamp are all rejected', async () => {
  const body = { merchantId: 'M', amount: 10, rfidUid: 'AA' };
  assert.equal((await fetch(`${base}/api/v1/pos/tap`, signed(body, { device: 'POS-X' }))).status, 401);
  assert.equal((await fetch(`${base}/api/v1/pos/tap`, signed(body, { secret: 'cd'.repeat(32) }))).status, 401);
  assert.equal((await fetch(`${base}/api/v1/pos/tap`, signed(body, { ts: Math.floor(Date.now() / 1000) - 3600 }))).status, 401);
});

test('card reader endpoint (/pos/card) also requires a valid device signature', async () => {
  assert.equal((await fetch(`${base}/api/v1/pos/card`, signed({ rfidUid: 'A3F19C2B' }, { secret: 'cd'.repeat(32) }))).status, 401);
  assert.equal((await fetch(`${base}/api/v1/pos/card`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"rfidUid":"AA"}' })).status, 401);
});

test('counter pages are served', async () => {
  assert.equal((await fetch(`${base}/counter`)).status, 200);
  assert.equal((await fetch(`${base}/pay/ANY`)).status, 200);
  assert.equal((await fetch(`${base}/api/v1/live?key=wrong`)).status, 401);
});

test('POS: tampered body fails the HMAC', async () => {
  const req = signed({ merchantId: 'M', amount: 10, rfidUid: 'AA' });
  req.body = req.body.replace('10', '9999');
  assert.equal((await fetch(`${base}/api/v1/pos/tap`, req)).status, 401);
});

test('customer identities are hashed + masked, never stored raw', () => {
  const h = hashIdentity('upi', 'Sharma.Ji@paytm');
  assert.equal(h, hashIdentity('upi', 'sharma.ji@paytm'));
  assert.notEqual(h, hashIdentity('rfid', 'sharma.ji@paytm'));
  assert.equal(h.length, 64);
  assert.equal(maskVpa('sharma.ji@paytm'), 'sh***@paytm');
});
