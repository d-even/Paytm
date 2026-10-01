// Runs the agent on a schedule so it works in the background — the merchant never
// has to open a dashboard for it to notice things.
const cron = require('node-cron');
const config = require('../config');
const agent = require('../agent');
const customerService = require('../services/customerService');
const { Merchant } = require('../models');
const log = require('../utils/logger');

async function forEachMerchant(fn, label) {
  const merchants = await Merchant.find({}, { merchantId: 1 }).lean();
  for (const { merchantId } of merchants) {
    try { await fn(merchantId); } catch (err) { log.error('scheduler', `${label} failed for ${merchantId}: ${err.message}`); }
  }
}

function startScheduler() {
  const tz = config.agent.timezone;

  cron.schedule(config.agent.cycleCron, () => forEachMerchant(async (id) => {
    await customerService.refreshSegments(id);
    await agent.runCycle(id);
  }, 'agent cycle'), { timezone: tz });

  cron.schedule(config.agent.briefingCron, () => forEachMerchant((id) => agent.dailyBriefing(id), 'daily briefing'), { timezone: tz });

  log.info('scheduler', `agent cycle "${config.agent.cycleCron}", daily briefing "${config.agent.briefingCron}" (${tz})`);
}

module.exports = { startScheduler };
