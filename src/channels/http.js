// Small fetch wrapper with a timeout, shared by all live channel adapters.
async function postJson(url, body, headers = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { response: data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { postJson };
