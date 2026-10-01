// Intelligence layer — thin wrapper around the Claude API.
// If no ANTHROPIC_API_KEY is set, `enabled` is false and every caller uses its
// deterministic fallback, so the whole pipeline still runs offline.
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const log = require('../utils/logger');

let client = null;
function getClient() {
  if (!config.llm.enabled) return null;
  if (!client) client = new Anthropic({ apiKey: config.llm.apiKey });
  return client;
}

async function complete({ system, user, maxTokens = config.llm.maxTokens, tag = 'agent:reason' }) {
  const c = getClient();
  if (!c) return null;
  try {
    const res = await c.messages.create({
      model: config.llm.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  } catch (err) {
    log.warn(tag, `Claude call failed, using fallback: ${err.message}`);
    return null;
  }
}

// Ask for JSON and parse it defensively (models sometimes wrap JSON in prose or fences).
async function completeJSON(args) {
  const text = await complete(args);
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    log.warn(args.tag || 'agent:reason', 'Claude returned non-JSON output, using fallback');
    return null;
  }
}

module.exports = { complete, completeJSON, get enabled() { return config.llm.enabled; } };
