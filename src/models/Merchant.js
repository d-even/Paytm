const { Schema, model } = require('mongoose');

// Trust modes per action family:
//   auto      → agent executes immediately, merchant is informed
//   recommend → agent queues it, merchant must approve via /agent/action/approve
//   off       → agent never proposes this kind of action
const TRUST_MODES = ['auto', 'recommend', 'off'];

const merchantSchema = new Schema(
  {
    merchantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    ownerName: String,
    category: { type: String, default: 'kirana' },
    city: String,
    phone: String,
    language: { type: String, default: 'hi-IN' }, // language the Soundbox speaks
    soundboxDeviceId: String,
    posDeviceIds: [String],

    settings: {
      trust: {
        marketing: { type: String, enum: TRUST_MODES, default: 'recommend' }, // WhatsApp offers
        loyalty: { type: String, enum: TRUST_MODES, default: 'auto' },       // in-store Soundbox nudges
        restock: { type: String, enum: TRUST_MODES, default: 'recommend' },
        credit: { type: String, enum: TRUST_MODES, default: 'recommend' },   // hard-locked to recommend in the trust engine
      },
      dailyBriefing: { type: Boolean, default: true },
      maxAutoMessagesPerDay: { type: Number, default: 100 },
      quietHours: { start: { type: Number, default: 21 }, end: { type: Number, default: 8 } }, // no auto WhatsApp in this window
      campaignSpendCap: { type: Number, default: 600 },  // max ₹ of discounts one campaign may give away
      undoWindowMinutes: { type: Number, default: 30 },  // auto actions can be undone for this long
    },

    // Shelf stock the agent watches for "running low" (decremented on every itemised bill).
    inventory: [{
      _id: false, name: String, stock: Number, price: Number, packLabel: String, packSize: Number, packCost: Number,
    }],

    // Inputs for the 14-day cash forecast (opening balance, cost of goods, known bills).
    cashflow: {
      openingBalance: { type: Number, default: 0 },
      cogsPct: { type: Number, default: 0.75 },
      dailyFixedCost: { type: Number, default: 0 },
      safetyThreshold: { type: Number, default: 5000 },
      payables: [{ _id: false, label: String, amount: Number, dueDate: Date }],
    },

    // Learn step writes here: per action kind, how often it worked and by how much.
    learning: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

module.exports = model('Merchant', merchantSchema);
module.exports.TRUST_MODES = TRUST_MODES;
