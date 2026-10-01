const config = require('./config');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { attachEventHandlers } = require('./agent');
const { startScheduler } = require('./jobs/scheduler');
const log = require('./utils/logger');
const { publicBaseUrl } = require('./utils/network');

async function main() {
  if (!config.apiKey || config.apiKey.startsWith('change-me')) log.warn('api', 'API_KEY is not set to a real secret — fine for local dev only');
  await connectDB();
  attachEventHandlers();   // event bus → agent (real-time POS path)
  startScheduler();        // background agent cycles + daily briefing
  const app = createApp();
  app.listen(config.port, () => {
    log.info('api', `Vyapaar Mitra Agent API  → http://localhost:${config.port}/api/v1`);
    log.info('api', `Merchant app (React)    → http://localhost:${config.port}/   (after: cd frontend && npm run build)`);
    log.info('api', `Simple counter (laptop) → http://localhost:${config.port}/counter`);
    log.info('api', `Phones & ESP32 reach it → ${publicBaseUrl()}   (same Wi-Fi)`);
  });
}

main().catch((err) => {
  log.error('api', `startup failed: ${err.message}`);
  process.exit(1);
});
