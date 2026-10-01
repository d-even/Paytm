// ② REASON — turn raw observations into ranked, explained opportunities.
//   Tools (deterministic)  → find the facts and the fitting action type
//   Claude (LLM)           → prioritise and explain them in the merchant's language,
//                            and write the customer-facing message copy
//   Guardrails             → the LLM can't invent findings, numbers or action types
const config = require('../config');
const tools = require('./tools');
const llm = require('./llm');
const { DAY_NAMES_HI } = require('../utils/time');
const log = require('../utils/logger');

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function topSeller(itemUnits) {
  const ranked = Object.entries(itemUnits).sort((a, b) => (b[1].last7 + b[1].prior21) - (a[1].last7 + a[1].prior21));
  return ranked.length ? ranked[0][0] : null;
}

// Step 1: run every tool over the snapshot.
function collectFindings(snapshot) {
  const opts = { regularVisitThreshold: config.agent.regularVisitThreshold, dormantAfterDays: config.agent.dormantAfterDays };
  const trend = tools.analyzeSalesTrend(snapshot);
  const findings = [
    ...trend.findings,
    ...tools.findDormantRegulars(snapshot, opts).findings,
    ...tools.assessCredit(snapshot).findings,
    ...tools.findLowStock(snapshot).findings,
    ...tools.findSlowMovers(snapshot).findings,
  ];
  return { findings, trendStats: trend.stats };
}

// Deterministic copy — used when Claude is unavailable, and as the safety net if its
// output fails validation. Hinglish by default, English if the merchant prefers it.
function templateCopy(f, snapshot) {
  const en = (snapshot.merchant.language || '').startsWith('en');
  const shop = snapshot.merchant.name;
  const top = topSeller(snapshot.itemUnits);
  const e = f.evidence;
  switch (f.id.startsWith('weekday-dip') ? 'weekday-dip' : f.id) {
    case 'weekday-dip': {
      const day = en ? e.weekdayName : DAY_NAMES_HI[e.weekday];
      const all = e.weeksBelowAverage === e.weeksObserved;
      const span = en
        ? (all ? `Every ${day} for the last ${e.weeksObserved} weeks` : `${e.weeksBelowAverage} of the last ${e.weeksObserved} ${day}s`)
        : (all ? `Pichle ${e.weeksObserved} hafton se lagatar` : `Pichle ${e.weeksObserved} mein se ${e.weeksBelowAverage} hafton`);
      return {
        summary: en
          ? `${span}, sales were below the rest of the week: ${inr(e.avgOnWeekday)} vs ${inr(e.avgOtherDays)} on average (${e.dipPct}% lower).`
          : `${span} ${day} ki sale baaki dinon se ${e.dipPct}% kam rahi hai — avg ${inr(e.avgOnWeekday)} vs ${inr(e.avgOtherDays)}.`,
        message: en
          ? `Hello from ${shop}! ${day} Special: 10% off${top ? ` on ${top}` : ''} — this ${day} only. See you soon!`
          : `Namaste! ${shop} mein ${day} Special — ${top ? `${top} par ` : ''}10% off, sirf is ${day} ko. Zaroor aaiye! 🙏`,
      };
    }
    case 'dormant-regulars':
      return {
        summary: en
          ? `${e.dormantCount} regular customers haven't visited in over ${config.agent.dormantAfterDays} days (avg ticket ${inr(e.avgTicket)}). ${e.reachableOnWhatsApp} can be reached on WhatsApp.`
          : `${e.dormantCount} regular customers ${config.agent.dormantAfterDays}+ din se nahi aaye (avg bill ${inr(e.avgTicket)}). Inmein se ${e.reachableOnWhatsApp} ko WhatsApp par bula sakte hain.`,
        message: en
          ? `We miss you at ${shop}! Show this message for 10% off your next purchase.`
          : `Namaste! Kaafi din ho gaye aapko ${shop} mein dekhe. Agli khareed par 10% off — bas yeh message dikhaiye. 🙏`,
      };
    case 'credit-eligible':
      return {
        summary: en
          ? `Your settlements have been steady for 4 weeks (${inr(e.monthlyGmv)}/month, ${e.activeDaysPct}% active days). You may be eligible for a business loan up to ${inr(e.indicativeLimit)}.`
          : `Aapke settlements pichle 4 hafton se stable hain (${inr(e.monthlyGmv)}/mahina, ${e.activeDaysPct}% din active). Aap ${inr(e.indicativeLimit)} tak ke business loan ke liye eligible ho sakte hain.`,
        message: en
          ? `Pre-qualified offer: business loan up to ${inr(e.indicativeLimit)}. Review and apply in 2 taps — final approval by the lending partner.`
          : `Pre-qualified offer: ${inr(e.indicativeLimit)} tak ka business loan. 2 tap mein apply karein — final approval lending partner karega.`,
      };
    case 'low-stock': {
      const list = e.items.map((i) => `${i.item} (${i.daysLeft} ${en ? 'days' : 'din'})`).join(', ');
      return {
        summary: en
          ? `At the current pace these run out soon: ${list}. A ${e.coverDays}-day reorder costs about ${inr(e.totalCost)}.`
          : `Is speed se yeh jaldi khatam honge: ${list}. ${e.coverDays} din ka order lagbhag ${inr(e.totalCost)} ka hoga.`,
        message: en
          ? `Reorder: ${e.items.map((i) => `${i.packs} × ${i.packLabel} ${i.item}`).join(', ')} — about ${inr(e.totalCost)}.`
          : `Order kijiye: ${e.items.map((i) => `${i.item} ${i.packs} × ${i.packLabel}`).join(', ')} — lagbhag ${inr(e.totalCost)}.`,
      };
    }
    case 'slow-movers': {
      const i = e.items[0];
      return {
        summary: en
          ? `${i.item} sold ${i.unitsLast7Days} units this week vs a usual ${i.usualWeeklyUnits} (${i.dropPct}% down).`
          : `${i.item} is hafte sirf ${i.unitsLast7Days} bike, aam taur par ${i.usualWeeklyUnits} bikte hain (${i.dropPct}% kam).`,
        message: en
          ? `Consider a smaller reorder for ${i.item}, or bundle it with a best-seller.`
          : `${i.item} ka agla order thoda kam rakhein, ya kisi best-seller ke saath combo banayein.`,
      };
    }
    default:
      return {
        summary: en ? f.title : `${f.title}.`,
        message: null,
      };
  }
}

const SYSTEM_PROMPT = `You are Vyapaar Mitra, an AI business copilot for a small Indian merchant who accepts payments on Paytm.
You receive FINDINGS that deterministic analytics already computed from the merchant's real transactions.
Your job:
1. Rank the findings by expected business impact for THIS merchant (priority 1 = most important).
2. For each finding write:
   - "title": max 12 words, plain language.
   - "summary": 1-2 short sentences for the merchant, in the requested language/style, using ONLY numbers present in the evidence.
   - "message": the text of the action (for customer offers: a warm, short WhatsApp message under 280 characters, no links, no false urgency; for merchant-facing actions: one practical sentence). Use null if the finding has no proposed action.
   - "confidence": your confidence 0-1 that acting on it will help.
3. Consider "learning": past outcomes of similar actions for this merchant. Lower confidence for action kinds that have not worked.
Rules: never invent numbers, customers, products or discounts above 10%. Never promise loan approval. Keep the merchant's language: hi-IN means friendly Hinglish in Latin script; en-IN means simple Indian English.
Respond with JSON only: {"insights":[{"id":string,"priority":number,"title":string,"summary":string,"message":string|null,"confidence":number}]}`;

async function reason(snapshot) {
  const { findings, trendStats } = collectFindings(snapshot);
  log.info('agent:reason', `${findings.length} finding(s) from tools: ${findings.map((f) => f.id).join(', ') || 'none'}`);
  if (!findings.length) return { insights: [], trendStats, usedLLM: false };

  // Start from the deterministic version…
  let insights = findings.map((f, i) => ({ ...f, ...templateCopy(f, snapshot), priority: i + 1 }));
  let usedLLM = false;

  // …and let Claude re-rank and re-write it, within guardrails.
  if (llm.enabled) {
    const payload = {
      merchant: { name: snapshot.merchant.name, category: snapshot.merchant.category, city: snapshot.merchant.city, language: snapshot.merchant.language },
      topSellingItem: topSeller(snapshot.itemUnits),
      learning: snapshot.learning,
      findings: findings.map((f) => ({ id: f.id, type: f.type, title: f.title, evidence: f.evidence, proposedAction: f.proposedAction?.kind || null, toolConfidence: f.confidence })),
    };
    const out = await llm.completeJSON({ system: SYSTEM_PROMPT, user: JSON.stringify(payload, null, 2), tag: 'agent:reason' });
    if (out && Array.isArray(out.insights)) {
      const byId = new Map(out.insights.map((x) => [x.id, x]));
      insights = insights.map((ins) => {
        const x = byId.get(ins.id);
        if (!x) return ins;
        const conf = Number(x.confidence);
        return {
          ...ins,
          title: typeof x.title === 'string' && x.title.length <= 120 ? x.title : ins.title,
          summary: typeof x.summary === 'string' && x.summary.length <= 400 ? x.summary : ins.summary,
          message: ins.proposedAction && typeof x.message === 'string' && x.message.length <= 300 ? x.message : ins.message,
          // Guardrail: the LLM may move tool confidence by at most ±0.2.
          confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, ins.confidence - 0.2, Math.min(ins.confidence + 0.2, conf))) : ins.confidence,
          priority: Number.isFinite(Number(x.priority)) ? Number(x.priority) : ins.priority,
        };
      });
      usedLLM = true;
    }
  }

  insights.sort((a, b) => a.priority - b.priority);
  log.info('agent:reason', `ranked via ${usedLLM ? 'Claude' : 'rule-based fallback'}: ${insights.map((i) => `${i.priority}.${i.type}`).join('  ')}`);
  return { insights, trendStats, usedLLM };
}

module.exports = { reason, collectFindings, templateCopy, topSeller };
