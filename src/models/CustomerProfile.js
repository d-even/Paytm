const { Schema, model } = require('mongoose');

// One row per (merchant, customer). Built entirely from payment data — the primary
// identity is the hashed UPI VPA; an RFID card can be linked as an alias so a tap
// at the POS resolves to the same person.
const customerProfileSchema = new Schema(
  {
    merchantId: { type: String, required: true, index: true },
    customerKey: { type: String, required: true },
    aliases: { type: [String], index: true }, // other identity hashes (rfid:…, upi:…)
    displayName: String,                       // optional, merchant-entered
    payerMasked: String,
    cardsMasked: { type: [String], default: [] }, // RFID cards of this customer, last 4 only (e.g. "****316F")

    phone: String,                             // only if the customer opted in
    whatsappOptIn: { type: Boolean, default: false },

    visitCount: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    firstSeen: Date,
    lastSeen: Date,
    segment: { type: String, enum: ['new', 'returning', 'regular', 'dormant'], default: 'new' },
    lastOfferAt: Date,
  },
  { timestamps: true }
);

customerProfileSchema.index({ merchantId: 1, customerKey: 1 }, { unique: true });
customerProfileSchema.virtual('avgTicket').get(function avgTicket() {
  return this.visitCount ? Math.round(this.totalSpend / this.visitCount) : 0;
});

module.exports = model('CustomerProfile', customerProfileSchema);
