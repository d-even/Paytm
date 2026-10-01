// ACTION LAYER — the agent's public API. Any Paytm surface (App, Soundbox cloud,
// WhatsApp bot, partner apps) plugs in here.
const { Router } = require('express');
const requireApiKey = require('../middleware/apiKey');
const agent = require('../agent');
const { resolveApproval } = require('../agent/act');
const { AgentInsight, AgentAction, Merchant } = require('../models');
const { TRUST_MODES } = require('../models/Merchant');
const { need } = require('../utils/validate');

const router = Router();
router.use(requireApiKey);

// POST /agent/query — ask the copilot anything about the business.
router.post('/query', async (req, res) => {
  need(req.body, ['merchantId', 'question']);
  const out = await agent.query(req.body.merchantId, String(req.body.question).slice(0, 500));
  res.json({ answer: out.answer, source: out.source, facts: req.query.debug ? out.facts : undefined });
});

// GET /agent/insights — what the agent found, plus anything waiting for approval.
router.get('/insights', async (req, res) => {
  need(req.query, ['merchantId']);
  const status = req.query.status || 'open';
  const [insights, pendingApprovals] = await Promise.all([
    AgentInsight.find({ merchantId: req.query.merchantId, ...(status === 'all' ? {} : { status }) }).sort({ createdAt: -1 }).limit(50).lean(),
    AgentAction.find({ merchantId: req.query.merchantId, status: 'pending_approval' }).sort({ createdAt: -1 }).lean(),
  ]);
  res.json({
    insights,
    pendingApprovals: pendingApprovals.map((a) => ({
      actionId: a._id, kind: a.kind, riskTier: a.riskTier, title: a.payload?.title, message: a.payload?.message,
      reasoning: a.reasoning, confidence: a.confidence, whyNotAuto: a.decisionTrace?.at(-1)?.detail, createdAt: a.createdAt,
    })),
  });
});

// GET /agent/actions — full audit trail: what the agent did and why.
router.get('/actions', async (req, res) => {
  need(req.query, ['merchantId']);
  const filter = { merchantId: req.query.merchantId };
  if (req.query.status) filter.status = req.query.status;
  const actions = await AgentAction.find(filter).sort({ createdAt: -1 }).limit(Math.min(200, Number(req.query.limit) || 50)).lean();
  res.json({ actions });
});

// POST /agent/action/approve — merchant approves or rejects a recommend-only action.
router.post('/action/approve', async (req, res) => {
  need(req.body, ['merchantId', 'actionId', 'decision']);
  if (!['approve', 'reject'].includes(req.body.decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  const action = await resolveApproval(req.body);
  res.json({ actionId: action._id, kind: action.kind, status: action.status, result: action.result });
});

// PATCH /agent/settings — merchant controls what may auto-execute.
router.patch('/settings', async (req, res) => {
  need(req.body, ['merchantId']);
  const merchant = await Merchant.findOne({ merchantId: req.body.merchantId });
  if (!merchant) return res.status(404).json({ error: 'merchant not found' });
  const trust = req.body.trust || {};
  for (const [family, mode] of Object.entries(trust)) {
    if (!['marketing', 'loyalty', 'restock', 'credit'].includes(family) || !TRUST_MODES.includes(mode)) {
      return res.status(400).json({ error: `invalid trust setting ${family}=${mode}` });
    }
    if (family === 'credit' && mode === 'auto') {
      return res.status(400).json({ error: 'credit actions are always recommend-only and cannot be set to auto' });
    }
    merchant.settings.trust[family] = mode;
  }
  for (const k of ['dailyBriefing', 'maxAutoMessagesPerDay', 'quietHours']) {
    if (req.body[k] !== undefined) merchant.settings[k] = req.body[k];
  }
  if (req.body.language) merchant.language = req.body.language;
  await merchant.save();
  res.json({ settings: merchant.settings, language: merchant.language });
});

// POST /agent/run — trigger a full Observe→Reason→Decide→Act→Learn cycle now.
router.post('/run', async (req, res) => {
  need(req.body, ['merchantId']);
  res.json(await agent.runCycle(req.body.merchantId));
});

// POST /agent/briefing — speak today's briefing on the Soundbox now.
router.post('/briefing', async (req, res) => {
  need(req.body, ['merchantId']);
  const action = await agent.dailyBriefing(req.body.merchantId);
  res.json(action ? { spoken: action.payload.message, status: action.status } : { spoken: null });
});

module.exports = router;
