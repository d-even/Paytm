// No hardware at the venue? This behaves exactly like the ESP32 terminal:
// same JSON body, same HMAC signature, same endpoint.
//
//   node scripts/virtualPos.js <RFID_UID>            # like the real reader: pays the bill open on the laptop
//   node scripts/virtualPos.js A3F19C2B              # Sharma ji (regular)
//   node scripts/virtualPos.js 7B22E4D1              # Gupta ji (lapsed regular)
//   node scripts/virtualPos.js <RFID_UID> <AMOUNT>   # legacy: amount sent by the device (POST /pos/tap)
//
// Uses API_BASE (default http://localhost:PORT), DEVICE_ID (default POS-RAMESH-01)
// and that device's secret from POS_DEVICE_SECRETS in .env.
const crypto = require('crypto');
const config = require('../src/config');

async function main() {
  const [uid, amountArg] = process.argv.slice(2);
  if (!uid) {
    console.error('usage: node scripts/virtualPos.js <RFID_UID> [AMOUNT] [MERCHANT_ID]');
    process.exit(1);
  }
  const deviceId = process.env.DEVICE_ID || 'POS-RAMESH-01';
  const secret = config.pos.deviceSecrets.get(deviceId);
  if (!secret) throw new Error(`no secret for ${deviceId} in POS_DEVICE_SECRETS`);
  const base = process.env.API_BASE || `http://localhost:${config.port}`;

  const cardOnly = !amountArg;
  const body = cardOnly
    ? JSON.stringify({ rfidUid: uid.toUpperCase() })
    : JSON.stringify({ merchantId: process.argv[4] || 'MID-RAMESH-001', amount: Number(amountArg), rfidUid: uid });
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${deviceId}.${ts}.${body}`).digest('hex');

  const res = await fetch(`${base}/api/v1/pos/${cardOnly ? 'card' : 'tap'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': deviceId, 'x-timestamp': String(ts), 'x-signature': signature },
    body,
  });
  const json = await res.json();
  if (res.ok) console.log(`✅ ${res.status} paid ₹${json.amount} · ${json.tag} · visit #${json.visit}`);
  else if (res.status === 409) console.log('ℹ️  no bill open — the card is now shown on the laptop screen so you can link it');
  else console.log(`❌ ${res.status} ${json.error}`);
  console.log('(watch the laptop counter screen / server log for the Soundbox)');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
