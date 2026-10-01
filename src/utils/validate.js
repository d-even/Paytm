// Minimal request validation helper — keeps routes readable without a schema library.
function need(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === '');
  if (missing.length) throw Object.assign(new Error(`missing field(s): ${missing.join(', ')}`), { status: 400 });
}

function positiveAmount(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1e7) throw Object.assign(new Error('amount must be a positive number (INR)'), { status: 400 });
  return Math.round(n * 100) / 100;
}

module.exports = { need, positiveAmount };
