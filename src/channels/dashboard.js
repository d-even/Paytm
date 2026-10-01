const config = require('../config');
const { ChannelMessage } = require('../models');
const { postJson } = require('./http');
const log = require('../utils/logger');
const { bus, EVENTS } = require('../events/bus');

// Dashboard / Paytm App / partner apps. Insights and pending approvals are always
// readable via GET /api/v1/agent/insights; this adapter additionally PUSHES them to a
// webhook if one is configured, so any surface can plug in without polling.
async function push({ merchantId, event, data, actionId }) {
  const url = config.channels.dashboardWebhookUrl;
  const text = data?.title || data?.summary || event;
  let status = 'sent'; let providerResponse;
  if (url) {
    try { providerResponse = await postJson(url, { merchantId, event, data }); }
    catch (err) { status = 'failed'; providerResponse = { error: err.message }; }
  }
  log.info('channel:dashboard', `📊 ${event}: ${text}`);
  bus.emit(EVENTS.CHANNEL_MESSAGE, { channel: 'dashboard', merchantId, event, data });
  return ChannelMessage.create({
    merchantId, actionId, channel: 'dashboard', to: url || 'in-app', text, mode: url ? 'live' : 'mock', status, providerResponse,
  });
}

module.exports = { push };
