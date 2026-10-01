const { Schema, model } = require('mongoose');

const INSIGHT_TYPES = ['SALES_DIP', 'SALES_GROWTH', 'DORMANT_REGULARS', 'CREDIT_ELIGIBLE', 'SLOW_MOVER', 'LOW_STOCK', 'PEAK_HOURS'];

const agentInsightSchema = new Schema(
  {
    merchantId: { type: String, required: true, index: true },
    cycleId: String,
    type: { type: String, enum: INSIGHT_TYPES, required: true },
    severity: { type: String, enum: ['info', 'opportunity', 'warning'], default: 'opportunity' },
    title: String,
    summary: String,        // human, merchant-language explanation (from the LLM or template)
    evidence: Schema.Types.Mixed, // the raw numbers behind it — keeps the agent explainable
    confidence: { type: Number, min: 0, max: 1 },
    status: { type: String, enum: ['open', 'actioned', 'dismissed', 'expired'], default: 'open' },
    dedupeKey: { type: String, index: true }, // same finding on the same day is stored once
  },
  { timestamps: true }
);

module.exports = model('AgentInsight', agentInsightSchema);
module.exports.INSIGHT_TYPES = INSIGHT_TYPES;
