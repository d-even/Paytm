const { Schema, model } = require('mongoose');

// Outbound log for every channel (Soundbox, WhatsApp, Dashboard). In mock mode this
// IS the delivery — you can read exactly what the merchant/customer would have received.
const channelMessageSchema = new Schema(
  {
    merchantId: { type: String, index: true },
    actionId: { type: Schema.Types.ObjectId, ref: 'AgentAction' },
    channel: { type: String, enum: ['soundbox', 'whatsapp', 'dashboard'], required: true },
    to: String,
    text: String,
    lang: String,
    mode: { type: String, enum: ['live', 'mock'] },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    providerResponse: Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = model('ChannelMessage', channelMessageSchema);
