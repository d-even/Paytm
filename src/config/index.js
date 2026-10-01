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
  defaultMerchantId: process.env.DEFAULT_MERCHANT_ID || 'MID-RAMESH-001',
  // Allowed browser origins for the React app in dev (Vite). Comma-separated; empty = same-origin only.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()).filter(Boolean),

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

  pos: {
    deviceSecrets: parseDeviceSecrets(process.env.POS_DEVICE_SECRETS),
    maxClockSkewSeconds: int('POS_MAX_CLOCK_SKEW_SECONDS', 120),
  },
};

config.llm.enabled = Boolean(config.llm.apiKey);

module.exports = config;
