const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const llm = require('./agent/llm');
const whatsapp = require('./channels/whatsapp');
const n8n = require('./integrations/n8n');
const sarvam = require('./integrations/sarvam');
const cognee = require('./integrations/cognee');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Keep the raw body: POS devices sign the exact bytes they send.
  app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

  // The React app in dev runs on Vite (another port) → allow it. In production it's same-origin.
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && config.corsOrigins.includes(origin)) {
      res.set({ 'access-control-allow-origin': origin, vary: 'origin', 'access-control-allow-headers': 'content-type, authorization, x-api-key, x-merchant-id', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, OPTIONS' });
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    next();
  });

  app.get('/api/v1/health', (_req, res) => res.json({
    status: 'ok',
    llm: llm.enabled ? `claude (${config.llm.model})` : 'rule-based fallback',
    channels: {
      soundbox: config.channels.soundboxWebhookUrl ? 'live' : 'mock',
      whatsapp: whatsapp.isLive() ? 'live' : 'mock',
      dashboard: config.channels.dashboardWebhookUrl ? 'webhook' : 'pull-only',
    },
    automation: n8n.enabled() ? 'n8n' : 'built-in channels',
    voice: sarvam.enabled() ? `sarvam (${config.sarvam.ttsModel})` : 'browser voice',
    memory: cognee.enabled() ? 'cognee + mongodb' : 'mongodb',
    posDevices: [...config.pos.deviceSecrets.keys()],
  }));

  // Laptop screens: counter (bill + QR + Soundbox voice + agent feed) and the phone pay page.
  const pub = path.join(__dirname, '..', 'public');
  const spa = path.join(__dirname, '..', 'frontend', 'dist');
  const hasSpa = fs.existsSync(path.join(spa, 'index.html'));
  if (!hasSpa) app.get('/', (_req, res) => res.redirect('/counter'));
  app.get('/counter', (_req, res) => res.sendFile(path.join(pub, 'counter.html')));
  app.get('/pay/:checkoutId', (_req, res) => res.sendFile(path.join(pub, 'pay.html')));

  app.use('/api/v1', require('./routes/live'));
  app.use('/api/v1', require('./routes/counter'));
  app.use('/api/v1', require('./routes/payments'));
  app.use('/api/v1', require('./routes/merchants'));
  app.use('/api/v1/agent', require('./routes/agent'));
  app.use('/api/v1/n8n', require('./routes/n8n')); // delivery receipts coming back from the n8n workflow
  app.use('/api/app', require('./routes/app')); // the React merchant app (frontend/)

  // Built React app (cd frontend && npm run build) — served at / with client-side routing.
  if (hasSpa) {
    app.use(express.static(spa, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (req, res, next) => (req.path.startsWith('/api/') ? next() : res.sendFile(path.join(spa, 'index.html'))));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
