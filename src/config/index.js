// Central configuration — every other module reads settings from here, never from process.env directly.
require('dotenv').config({ quiet: true });

function int(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}

function parseDeviceSecrets(raw) {
  // "POS-1:secretA,POS-2:secretB"  ->  Map { 'POS-1' => 'secretA', ... }
  const map = new Map();
  (raw || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((pair) => {
    const idx = pair.indexOf(':');
    if (idx > 0) map.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  });
  return map;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 4000),
  apiKey: process.env.API_KEY || '',
  // Base URL phones use to open the QR pay page. Empty = auto-detect this laptop's LAN IP.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  checkoutTtlSeconds: int('CHECKOUT_TTL_SECONDS', 300),
  // Merchant the web app signs into (demo OTP login: any number → this shop unless the phone matches another merchant).
  defaultMerchantId: process.env.DEFAULT_MERCHANT_ID || 'MID-DEVEN-001',
  // Allowed browser origins for the React app in dev (Vite). Comma-separated; empty = same-origin only.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()).filter(Boolean),

  // RFID card UIDs of the two customers the demo shop knows by name (Serial Monitor prints them as
  // "[rfid] card 21E7316F"). Put your real cards here (.env) and run `npm run seed`; the defaults
  // are the virtual cards behind the app's "Tap card" button.
  cards: {
    chinu: (process.env.CARD_UID_CHINU || 'A3F19C2B').trim().toUpperCase(),
    shravni: (process.env.CARD_UID_SHRAVNI || '7B22E4D1').trim().toUpperCase(),
  },

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vyapaar_mitra',
  identityPepper: process.env.IDENTITY_PEPPER || 'dev-only-pepper',

  llm: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    maxTokens: int('LLM_MAX_TOKENS', 1200),
  },

  agent: {
    cycleCron: process.env.AGENT_CYCLE_CRON || '*/30 * * * *',
    briefingCron: process.env.DAILY_BRIEFING_CRON || '0 9 * * *',
    timezone: process.env.TZ || 'Asia/Kolkata',
    lookbackDays: int('AGENT_LOOKBACK_DAYS', 28),
    regularVisitThreshold: int('REGULAR_VISIT_THRESHOLD', 5),
    dormantAfterDays: int('DORMANT_AFTER_DAYS', 14),
    learnEvalWindowHours: int('LEARN_EVAL_WINDOW_HOURS', 168),
  },

  channels: {
    soundboxWebhookUrl: process.env.SOUNDBOX_WEBHOOK_URL || '',
    soundboxDefaultLang: process.env.SOUNDBOX_DEFAULT_LANG || 'hi-IN',
    whatsapp: {
      apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    },
    dashboardWebhookUrl: process.env.DASHBOARD_WEBHOOK_URL || '',
  },

  // n8n = the execution backbone: approved actions are handed to an n8n workflow (WhatsApp, inventory, Paytm surface).
  // Empty N8N_WEBHOOK_URL = off, and the built-in channels run exactly as before.
  n8n: {
    webhookUrl: (process.env.N8N_WEBHOOK_URL || '').trim(),
    sharedSecret: (process.env.N8N_SHARED_SECRET || '').trim(),
    timeoutMs: int('N8N_TIMEOUT_MS', 60000),
  },

  // Sarvam AI = the voice and language layer: the agent's Soundbox lines are spoken by Bulbul (and translated by Mayura
  // for non-Hindi shops). Empty SARVAM_API_KEY = off, and the browser's own voice reads the lines as before.
  sarvam: {
    apiKey: (process.env.SARVAM_API_KEY || '').trim(),
    baseUrl: (process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai').replace(/\/$/, ''),
    ttsModel: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
    speaker: process.env.SARVAM_SPEAKER || 'shubh',
    translateModel: process.env.SARVAM_TRANSLATE_MODEL || 'mayura:v1',
    timeoutMs: int('SARVAM_TIMEOUT_MS', 10000),
  },

  // Cognee = the memory layer: a small Python service (cognee-service/) that turns what happened at the shop into a
  // knowledge graph. Empty COGNEE_URL = off, and the agent keeps learning from MongoDB only.
  cognee: {
    url: (process.env.COGNEE_URL || '').trim().replace(/\/$/, ''),
    serviceKey: (process.env.COGNEE_SERVICE_KEY || '').trim(),
    flushMs: int('COGNEE_FLUSH_MS', 60000),
    timeoutMs: int('COGNEE_TIMEOUT_MS', 20000),
    recallTimeoutMs: int('COGNEE_RECALL_TIMEOUT_MS', 8000),
  },

  pos: {
    deviceSecrets: parseDeviceSecrets(process.env.POS_DEVICE_SECRETS),
    maxClockSkewSeconds: int('POS_MAX_CLOCK_SKEW_SECONDS', 120),
  },
};

config.llm.enabled = Boolean(config.llm.apiKey);

module.exports = config;
