const { Schema, model } = require('mongoose');

const transactionSchema = new Schema(
  {
    txnId: { type: String, required: true, unique: true },
    merchantId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 }, // INR
    channel: { type: String, enum: ['UPI', 'QR', 'CARD_TAP'], required: true },
    source: { type: String, enum: ['upi', 'pos'], required: true }, // primary vs complementary data stream
    status: { type: String, enum: ['SETTLED', 'FAILED'], default: 'SETTLED' },

    customerKey: { type: String, index: true }, // peppered hash, never the raw VPA/UID
    payerMasked: String,                         // e.g. "ra***@paytm" or "****A3F1"
    deviceId: String,

    items: [{ _id: false, name: String, qty: Number, price: Number }],
    settledAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

transactionSchema.index({ merchantId: 1, settledAt: -1 });

module.exports = model('Transaction', transactionSchema);
