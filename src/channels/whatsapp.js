const config = require('../config');
const { ChannelMessage } = require('../models');
const { postJson } = require('./http');
const log = require('../utils/logger');
const { bus, EVENTS } = require('../events/bus');

// WhatsApp Business Cloud API adapter. Only customers who opted in (whatsappOptIn=true,
// phone on file) are ever messaged. Without credentials we run in mock mode.
function isLive() {
  const w = config.channels.whatsapp;
  return Boolean(w.phoneNumberId && w.accessToken);
}

async function sendText({ merchantId, to, text, actionId }) {
  const w = config.channels.whatsapp;
  const live = isLive();
  let status = 'sent'; let providerResponse;

  if (live) {
    try {
      providerResponse = await postJson(
        `${w.apiUrl}/${w.phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text } },
        { authorization: `Bearer ${w.accessToken}` }
      );
    } catch (err) {
      status = 'failed'; providerResponse = { error: err.message, response: err.response };
      log.error('channel:whatsapp', `delivery to ${to} failed: ${err.message}`);
    }
  }
  return ChannelMessage.create({
    merchantId, actionId, channel: 'whatsapp', to, text, mode: live ? 'live' : 'mock', status, providerResponse,
  });
}

// Fan a single offer out to a list of opted-in customers.
async function broadcast({ merchantId, recipients, text, actionId }) {
  const results = [];
  for (const r of recipients) results.push(await sendText({ merchantId, to: r.phone, text, actionId }));
  const sent = results.filter((m) => m.status === 'sent').length;
  bus.emit(EVENTS.CHANNEL_MESSAGE, { channel: 'whatsapp', merchantId, text, to: `${sent} customers`, mode: isLive() ? 'live' : 'mock' });
  log.info('channel:whatsapp', `💬 offer sent to ${sent}/${recipients.length} customers${isLive() ? '' : ' (mock)'}`, `"${text}"`);
  return { sent, failed: results.length - sent, messageIds: results.map((m) => m._id) };
}

module.exports = { sendText, broadcast, isLive };
