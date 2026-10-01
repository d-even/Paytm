const { Schema, model } = require('mongoose');

// A bill opened on the laptop counter screen. The customer settles it EITHER by tapping
// an RFID card on the ESP32 reader OR by scanning the QR with their phone.
const checkoutSchema = new Schema(
  {
    checkoutId: { type: String, required: true, unique: true },
    merchantId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    items: [{ _id: false, name: String, qty: Number, price: Number }],
    status: { type: String, enum: ['pending', 'processing', 'paid', 'cancelled', 'expired'], default: 'pending', index: true },
    method: { type: String, enum: ['card', 'qr'] },
    txnId: String,
    payer: String,         // masked
    expiresAt: { type: Date, required: true },
    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = model('Checkout', checkoutSchema);
