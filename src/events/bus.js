const { EventEmitter } = require('events');

// In-process event bus: the "parallel stream" arrow in the architecture, where every
// settled payment is ALSO handed to the agent. Swap for Kafka / Redis Streams / SQS in
// production — publishers and subscribers don't change, only this file does.
const bus = new EventEmitter();
bus.setMaxListeners(50);

const EVENTS = {
  TXN_SETTLED: 'transaction.settled', // primary signal: any settled UPI/QR/card payment
  POS_TAP: 'pos.tap',                 // complementary signal: customer physically at the counter (card or counter QR)
  CARD_SCANNED: 'card.scanned',       // a card was read but there was no bill open (used to register cards)
  CHECKOUT_UPDATED: 'checkout.updated',
  CHANNEL_MESSAGE: 'channel.message', // every Soundbox / WhatsApp / dashboard delivery → laptop screen
  INSIGHT_CREATED: 'insight.created',
  ACTION_EXECUTED: 'action.executed',
  ACTION_UPDATED: 'action.updated',   // any status change (queued, approved, paused, undone…) → app refreshes
};

module.exports = { bus, EVENTS };
