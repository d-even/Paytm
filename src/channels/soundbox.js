const config = require('../config');
const { ChannelMessage } = require('../models');
const { postJson } = require('./http');
const sarvam = require('../integrations/sarvam');
const log = require('../utils/logger');
const { bus, EVENTS } = require('../events/bus');

// Soundbox = the voice of the agent at the counter. The device does TTS itself; we
// send it text + language. With no webhook configured we run in mock mode and log it.
async function speak({ merchant, text, lang, actionId }) {
  const deviceId = merchant.soundboxDeviceId || 'SOUNDBOX-UNKNOWN';
  const language = lang || merchant.language || config.channels.soundboxDefaultLang;
  const live = Boolean(config.channels.soundboxWebhookUrl);
  let status = 'sent'; let providerResponse;
  // Sarvam (when configured): natural Indian-language speech. null → the counter screen's own voice reads `text`.
  const v = await sarvam.voice(text, language);

  if (live) {
    try {
      providerResponse = await postJson(config.channels.soundboxWebhookUrl, { deviceId, text: v?.text || text, lang: v?.lang || language, ...(v ? { audio: v.audio, mime: v.mime } : {}) });
    } catch (err) {
      status = 'failed'; providerResponse = { error: err.message, response: err.response };
      log.error('channel:soundbox', `delivery failed: ${err.message}`);
    }
  }
  log.info('channel:soundbox', `🔊 [${deviceId}] "${text}"`);
  // The laptop counter screen listens for this and speaks it out loud (browser TTS).
  bus.emit(EVENTS.CHANNEL_MESSAGE, {
    channel: 'soundbox', merchantId: merchant.merchantId, text: v?.text || text, lang: v?.lang || language, actionId: actionId ? String(actionId) : undefined,
    ...(v ? { audio: v.audio, mime: v.mime } : {}),
  });
  return ChannelMessage.create({
    merchantId: merchant.merchantId, actionId, channel: 'soundbox', to: deviceId, text, lang: language,
    mode: live ? 'live' : 'mock', status, providerResponse,
  });
}

module.exports = { speak };
