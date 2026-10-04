// The agent loop:  ① Observe → ② Reason → ③ Decide → ④ Act → ⑤ Learn
// plus two event-driven paths that reuse the same Decide/Act steps:
//   • real-time POS/RFID tap  → loyalty nudge on the Soundbox (complementary signal)
//   • daily briefing          → spoken summary every morning
const config = require('../config');
const { AgentInsight, AgentAction, Merchant } = require('../models');
const { buildSnapshot } = require('./observe');
const { reason, topSeller } = require('./reason');
const { decide } = require('./decide');
const { dispatch, countAutoMessagesToday, resolveAudience } = require('./act');
const { learn } = require('./learn');
const tools = require('./tools');
const llm = require('./llm');
const channels = require('../channels');
const { bus, EVENTS } = require('../events/bus');
const { localParts, DAY_NAMES, DAY_NAMES_HI } = require('../utils/time');
const log = require('../utils/logger');

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const running = new Set(); // one cycle per merchant at a time

function dedupeKeyFor(ins, todayKey) {
  // Weekday offers dedupe on their target day; everything else once per day.
  return ins.evidence?.targetDate ? `${ins.id}:${ins.evidence.targetDate}` : `${ins.id}:${todayKey}`;
}

async function runCycle(merchantId, { now = new Date() } = {}) {
  if (running.has(merchantId)) return { skipped: true, reason: 'cycle already running' };
  running.add(merchantId);
  const cycleId = `cyc_${now.getTime().toString(36)}`;
  const summary = { cycleId, merchantId, insightsCreated: 0, actions: [], learned: null };

  try {
    // ① OBSERVE
    const snapshot = await buildSnapshot(merchantId, { now });
    const { merchant } = snapshot;

    // ② REASON
    const { insights, usedLLM } = await reason(snapshot);
    summary.usedLLM = usedLLM;

    const ctx = {
      now,
      localHour: localParts(now).hour,
      recentActions: [...snapshot.recentActions],
      learning: snapshot.learning,
      autoMessagesToday: await countAutoMessagesToday(merchantId),
    };

    for (const ins of insights) {
      const dedupeKey = dedupeKeyFor(ins, snapshot.todayKey);
      if (await AgentInsight.exists({ merchantId, dedupeKey })) {
        log.info('agent:reason', `"${ins.type}" already raised (${dedupeKey}) — not repeating`);
        continue;
      }
      const insight = await AgentInsight.create({
        merchantId, cycleId, type: ins.type, severity: ins.severity, title: ins.title, summary: ins.summary,
        evidence: ins.evidence, confidence: ins.confidence, dedupeKey,
      });
      summary.insightsCreated += 1;
      bus.emit(EVENTS.INSIGHT_CREATED, insight);
      await channels.dashboard.push({ merchantId, event: 'insight.created', data: { id: insight._id, title: insight.title, summary: insight.summary } });

      if (!ins.proposedAction) continue;

      // ③ DECIDE
      const pa = ins.proposedAction;
      const recipientCount = pa.family === 'marketing' ? (await resolveAudience(merchantId, pa.audience, now)).length : 0;
      const proposal = {
        kind: pa.kind, family: pa.family, riskTier: pa.riskTier, confidence: ins.confidence,
        customerFacing: pa.family === 'marketing', recipientCount,
        reasoning: ins.summary,
        payload: {
          title: ins.title, message: ins.message, audience: pa.audience, dedupeKey, recipientCount,
          targetDate: ins.evidence?.targetDate, baseline: ins.evidence?.avgOnWeekday,
          indicativeLimit: ins.evidence?.indicativeLimit, items: ins.evidence?.items,
          totalCost: ins.evidence?.totalCost, weekdayName: ins.evidence?.weekdayName,
          costCap: pa.family === 'marketing' ? (merchant.settings?.campaignSpendCap ?? 600) : ins.evidence?.totalCost,
        },
      };
      const decision = decide(proposal, merchant, ctx);
      log.info('agent:decide', `${proposal.kind} → ${decision.mode.toUpperCase()}`, decision.trace.at(-1)?.detail);

      if (decision.mode === 'skip') {
        const a = await AgentAction.create({
          merchantId, cycleId, insightId: insight._id, kind: proposal.kind, family: proposal.family, riskTier: proposal.riskTier,
          mode: 'recommend', status: 'skipped', payload: proposal.payload, reasoning: proposal.reasoning,
          confidence: proposal.confidence, decisionTrace: decision.trace,
        });
        summary.actions.push({ id: a._id, kind: a.kind, status: a.status });
        continue;
      }

      // ④ ACT
      const action = await dispatch({ merchant, proposal, decision, cycleId, insightId: insight._id });
      ctx.recentActions.push(action.toObject());
      if (action.status === 'executed' && proposal.customerFacing) ctx.autoMessagesToday += action.result?.sent || 0;
      summary.actions.push({ id: action._id, kind: action.kind, mode: action.mode, status: action.status });
    }

    // ⑤ LEARN — feeds merchant.learning, read by the next cycle's Reason + Decide.
    summary.learned = await learn(merchantId, { now });
    return summary;
  } finally {
    running.delete(merchantId);
  }
}

// ── Real-time path: POS / RFID tap (complementary signal) ────────────────────────
async function onPosTap({ merchantId, customer, via = 'card' }) {
  const now = new Date();
  const rec = tools.recognizeCustomer(
    { customer, prevLastSeen: customer?.$locals?.prevLastSeen, now },
    { regularVisitThreshold: config.agent.regularVisitThreshold, dormantAfterDays: config.agent.dormantAfterDays }
  );
  if (!rec) return null;

  const merchant = await Merchant.findOne({ merchantId });
  const en = (merchant.language || '').startsWith('en');
  const n = rec.visitCount;
  // A customer the merchant has named (Chinu, Shravni Chavan) is greeted by name.
  const who = customer?.displayName;
  const message = rec.reason === 'lapsed-regular-returned'
    ? (en ? `${who || 'A regular'} is back after ${rec.gapDays} days — welcome them with ${rec.discountPct}% off.`
      : `${who ? `${who} ji` : 'Purane regular customer'} ${rec.gapDays} din baad wapas aaye hain — welcome back, ${rec.discountPct}% discount dijiye.`)
    : (en ? `${who ? `${who} is a regular` : 'Regular customer'}, visit number ${n} — offer a ${rec.discountPct}% loyalty discount.`
      : `${who ? `${who} ji regular customer` : 'Yeh regular customer'} hain, ${n}vi baar aaye hain — ${rec.discountPct}% loyalty discount dijiye.`);

  const how = via === 'qr' ? 'UPI QR at counter' : 'RFID card tap';
  log.info('agent:realtime', `${how} recognised: ${rec.reason} (visit #${n})`);
  const proposal = {
    kind: 'LOYALTY_NUDGE', family: 'loyalty', riskTier: 'low', confidence: rec.confidence, customerFacing: false,
    reasoning: `Recognised at counter via ${how}: ${rec.reason}, visit #${n}`,
    payload: { message, visitCount: n, discountPct: rec.discountPct, reason: rec.reason, via },
  };
  const decision = decide(proposal, merchant, { now, localHour: localParts(now).hour, recentActions: [], learning: merchant.learning });
  if (decision.mode === 'skip') return null;
  return dispatch({ merchant, proposal, decision });
}

// ── Daily briefing (spoken on the Soundbox every morning) ─────────────────────────
async function dailyBriefing(merchantId, { now = new Date() } = {}) {
  const snapshot = await buildSnapshot(merchantId, { now });
  const { merchant } = snapshot;
  if (merchant.settings?.dailyBriefing === false) return null;

  const trend = tools.analyzeSalesTrend(snapshot).stats;
  if (!trend.yesterday) return null;
  const en = (merchant.language || '').startsWith('en');
  const y = trend.yesterday;
  const change = trend.yesterdayVsLastWeekPct;
  const dayName = en ? DAY_NAMES[y.weekday] : DAY_NAMES_HI[y.weekday];
  const top = topSeller(snapshot.itemUnits);
  const openCount = await AgentInsight.countDocuments({ merchantId, status: 'open' });

  let text = en
    ? `Good morning ${merchant.ownerName || ''}. Yesterday's sales were ${inr(y.total)} from ${y.count} payments${change !== null ? `, ${Math.abs(change)}% ${change >= 0 ? 'more' : 'less'} than last ${dayName}` : ''}.${top ? ` Top seller: ${top}.` : ''}${openCount ? ` I have ${openCount} suggestion${openCount > 1 ? 's' : ''} for you in the app.` : ''}`
    : `Good morning ${merchant.ownerName || ''} ji. Kal ki sale ${inr(y.total)} thi, ${y.count} payments${change !== null ? ` — pichle ${dayName} se ${Math.abs(change)}% ${change >= 0 ? 'zyada' : 'kam'}` : ''}.${top ? ` Sabse zyada bika: ${top}.` : ''}${openCount ? ` App mein aapke liye ${openCount} sujhaav hain.` : ''}`;

  if (llm.enabled) {
    const polished = await llm.complete({
      tag: 'agent:reason',
      maxTokens: 200,
      system: 'Rewrite this Soundbox morning briefing to sound natural when spoken aloud, in the same language and style (Hinglish in Latin script if it is Hinglish). Keep every number exactly. Max 45 words. Output only the briefing text.',
      user: text,
    });
    if (polished && polished.length < 400) text = polished.replace(/^"|"$/g, '');
  }

  return dispatch({
    merchant,
    proposal: { kind: 'DAILY_BRIEFING', family: 'info', riskTier: 'low', confidence: 1, reasoning: 'Scheduled daily briefing', payload: { message: text, stats: trend } },
    decision: { mode: 'auto', trace: [{ rule: 'informational', result: 'pass', detail: 'briefings are read-only, always delivered' }] },
  });
}

// ── Conversational query: POST /agent/query ───────────────────────────────────────
function factsFrom(snapshot, openInsights) {
  const d = snapshot.daily;
  const today = d.find((x) => x.dayKey === snapshot.todayKey) || { total: 0, count: 0 };
  const complete = d.filter((x) => x.dayKey < snapshot.todayKey);
  const sum = (arr) => Math.round(arr.reduce((s, x) => s + x.total, 0));
  const items = Object.entries(snapshot.itemUnits).sort((a, b) => b[1].last7 - a[1].last7).slice(0, 5).map(([name, u]) => ({ name, unitsLast7Days: u.last7 }));
  const peak = [...snapshot.hourly].sort((a, b) => b.count - a.count)[0];
  return {
    today: { sales: Math.round(today.total), payments: today.count },
    yesterday: complete.length ? { sales: Math.round(complete.at(-1).total), payments: complete.at(-1).count } : null,
    last7Days: sum(complete.slice(-7)),
    previous7Days: sum(complete.slice(-14, -7)),
    last28Days: sum(complete.slice(-28)),
    topItemsThisWeek: items,
    busiestHour: peak?.count ? `${peak.hour}:00-${peak.hour + 1}:00` : null,
    customers: snapshot.customerSummary,
    openSuggestions: openInsights.map((i) => ({ type: i.type, title: i.title, summary: i.summary })),
    learning: snapshot.learning,
  };
}

function fallbackAnswer(q, f, en) {
  const s = q.toLowerCase();
  if (/(aaj|today)/.test(s)) return en ? `Today so far: ${inr(f.today.sales)} from ${f.today.payments} payments.` : `Aaj ab tak ${inr(f.today.sales)} ki sale hui hai, ${f.today.payments} payments se.`;
  if (/(kal|yesterday)/.test(s) && f.yesterday) return en ? `Yesterday: ${inr(f.yesterday.sales)} from ${f.yesterday.payments} payments.` : `Kal ${inr(f.yesterday.sales)} ki sale hui thi, ${f.yesterday.payments} payments se.`;
  if (/(item|bika|top|best|sabse)/.test(s) && f.topItemsThisWeek.length) return en ? `Top seller this week: ${f.topItemsThisWeek[0].name} (${f.topItemsThisWeek[0].unitsLast7Days} units).` : `Is hafte sabse zyada ${f.topItemsThisWeek[0].name} bika — ${f.topItemsThisWeek[0].unitsLast7Days} units.`;
  if (/(hafte|week)/.test(s)) return en ? `Last 7 days: ${inr(f.last7Days)} (previous 7 days: ${inr(f.previous7Days)}).` : `Pichle 7 din mein ${inr(f.last7Days)} ki sale hui (usse pehle ke 7 din: ${inr(f.previous7Days)}).`;
  if (/(loan|credit|udhar)/.test(s)) {
    const c = f.openSuggestions.find((i) => i.type === 'CREDIT_ELIGIBLE');
    return c ? c.summary : (en ? 'No pre-qualified credit offer right now — keep settlements steady and I will flag it.' : 'Abhi koi pre-qualified loan offer nahi hai — settlements steady rakhiye, main bata dunga.');
  }
  if (/(customer|grahak|regular)/.test(s)) return en ? `${f.customers.total} customers, ${f.customers.regulars} regulars, ${f.customers.dormant} haven't come back recently.` : `Aapke ${f.customers.total} customers hain — ${f.customers.regulars} regular, ${f.customers.dormant} kaafi din se nahi aaye.`;
  if (f.openSuggestions.length) return f.openSuggestions[0].summary;
  return en ? `Last 7 days: ${inr(f.last7Days)}. Ask me about today's sales, top items, customers or credit.` : `Pichle 7 din ki sale ${inr(f.last7Days)} hai. Aaj ki sale, top items, customers ya loan ke baare mein poochiye.`;
}

async function query(merchantId, question, { language } = {}) {
  const snapshot = await buildSnapshot(merchantId);
  const openInsights = await AgentInsight.find({ merchantId, status: 'open' }).sort({ createdAt: -1 }).limit(5).lean();
  const facts = factsFrom(snapshot, openInsights);
  const en = language ? language === 'en' : (snapshot.merchant.language || '').startsWith('en');

  let answer = null;
  if (llm.enabled) {
    answer = await llm.complete({
      tag: 'agent:reason',
      maxTokens: 300,
      system: `You are Vyapaar Mitra, a business copilot for ${snapshot.merchant.name}, a ${snapshot.merchant.category} in ${snapshot.merchant.city}. Answer the merchant's question in 1-3 short sentences using ONLY the FACTS JSON. If the facts don't contain the answer, say so briefly. Reply in ${en ? 'simple Indian English' : 'friendly Hinglish (Latin script)'}. Amounts in ₹ with Indian digit grouping.`,
      user: `FACTS:\n${JSON.stringify(facts)}\n\nQUESTION: ${question}`,
    });
  }
  return { answer: answer || fallbackAnswer(question, facts, en), source: answer ? 'claude' : 'rules', facts };
}

// Wire the event bus → agent (the parallel stream in the architecture).
function attachEventHandlers() {
  bus.on(EVENTS.POS_TAP, (evt) => {
    onPosTap(evt).catch((err) => log.error('agent:realtime', err.message));
  });
}

module.exports = { runCycle, onPosTap, dailyBriefing, query, attachEventHandlers };
