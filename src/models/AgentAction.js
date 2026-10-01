const { Schema, model } = require('mongoose');

// The audit trail. Every decision the agent makes — executed, queued, rejected or
// skipped — lands here with its reasoning, so "why did the agent do that?" always
// has an answer.
const ACTION_KINDS = [
  'WHATSAPP_OFFER',      // marketing  (low risk)
  'WINBACK_MESSAGE',     // marketing  (low risk)
  'LOYALTY_NUDGE',       // loyalty    (low risk, real-time from POS/RFID)
  'RESTOCK_ALERT',       // restock    (medium)
  'CREDIT_OFFER',        // credit     (high risk — always recommend-only)
  'DAILY_BRIEFING',      // informational
];

const agentActionSchema = new Schema(
  {
    merchantId: { type: String, required: true, index: true },
    cycleId: String,
    insightId: { type: Schema.Types.ObjectId, ref: 'AgentInsight' },
    kind: { type: String, enum: ACTION_KINDS, required: true },
    family: { type: String, enum: ['marketing', 'loyalty', 'restock', 'credit', 'info'], required: true },
    riskTier: { type: String, enum: ['low', 'medium', 'high'], required: true },

    mode: { type: String, enum: ['auto', 'recommend'], required: true },
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'rejected', 'executed', 'failed', 'skipped', 'paused', 'undone'],
      default: 'pending_approval',
      index: true,
    },

    payload: Schema.Types.Mixed,       // what will be sent / done
    reasoning: String,                 // why the agent wants to do it
    confidence: Number,
    decisionTrace: Schema.Types.Mixed, // why the trust engine chose auto vs recommend

    decidedBy: { type: String, enum: ['agent', 'merchant'], default: 'agent' },
    executedAt: Date,
    undoUntil: Date, // auto-executed actions can be paused/undone until this time
    result: Schema.Types.Mixed,

    // Filled by the Learn step once the evaluation window has passed.
    outcome: {
      evaluatedAt: Date,
      metric: String,
      baseline: Number,
      observed: Number,
      liftPct: Number,
      verdict: { type: String, enum: ['positive', 'neutral', 'negative'] },
    },
  },
  { timestamps: true }
);

module.exports = model('AgentAction', agentActionSchema);
module.exports.ACTION_KINDS = ACTION_KINDS;
