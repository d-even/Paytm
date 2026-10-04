// Cognee = the memory layer. Facts about the shop (payments, offers sent, measured results) are sent to a small
// Python service (cognee-service/) that builds a knowledge graph; the agent later asks it questions in plain language.
//
// Never required: with no COGNEE_URL everything here is a no-op and the agent learns from MongoDB alone.
// remember() only queues; facts go out in batches (building the graph costs LLM calls), and a Cognee outage never
// slows or breaks a payment or an agent cycle.
const config = require('../config');
const { postJson } = require('../channels/http');
const log = require('../utils/logger');

const enabled = () => Boolean(config.cognee.url);
const MAX_QUEUED = 300;
const queue = new Map(); // merchantId → string[]
let timer = null;

const headers = () => (config.cognee.serviceKey ? { 'x-service-key': config.cognee.serviceKey } : {});

function remember(merchantId, fact) {
  if (!enabled() || !merchantId || !fact) return;
  const list = queue.get(merchantId) || [];
  list.push(String(fact));
  if (list.length > MAX_QUEUED) list.splice(0, list.length - MAX_QUEUED);
  queue.set(merchantId, list);
  if (!timer) {
    timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, config.cognee.flushMs);
    timer.unref?.();
  }
}

// Send everything queued (for one shop, or all). Returns how many facts were accepted.
async function flush(merchantId) {
  if (!enabled()) return 0;
  let accepted = 0;
  for (const id of merchantId ? [merchantId] : [...queue.keys()]) {
    const texts = queue.get(id) || [];
    if (!texts.length) continue;
    queue.set(id, []);
    try {
      await postJson(`${config.cognee.url}/remember`, { merchantId: id, texts }, headers(), config.cognee.timeoutMs);
      accepted += texts.length;
    } catch (err) {
      log.warn('cognee', `could not store ${texts.length} fact(s): ${err.message} — will retry with the next batch`);
      queue.set(id, [...texts, ...(queue.get(id) || [])].slice(-MAX_QUEUED));
    }
  }
  return accepted;
}

// Ask the graph a question. Returns a short answer string, or null (off, nothing remembered yet, or any error).
async function recall(merchantId, query) {
  if (!enabled()) return null;
  try {
    const res = await postJson(`${config.cognee.url}/recall`, { merchantId, query }, headers(), config.cognee.recallTimeoutMs);
    return typeof res?.answer === 'string' && res.answer.trim() ? res.answer.trim().slice(0, 1500) : null;
  } catch (err) {
    log.warn('cognee', `recall failed: ${err.message}`);
    return null;
  }
}

module.exports = { enabled, remember, flush, recall, _queue: queue };
