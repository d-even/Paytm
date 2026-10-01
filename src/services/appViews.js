// Builds the JSON the React app expects (its contract lives in frontend/src/mocks/types.ts)
// from the agent's real data. Nothing here makes decisions — it only shapes data.
const config = require('../config');
const { Merchant, Transaction, CustomerProfile, AgentInsight, AgentAction, ChannelMessage, Checkout } = require('../models');
const { buildSnapshot } = require('../agent/observe');
const tools = require('../agent/tools');
const { startOfLocalDay, localParts, DAY_NAMES } = require('../utils/time');

const REWARD_EVERY = 12; // loyalty reward on every 12th visit
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const httpError = (status, message) => Object.assign(new Error(message), { status });
const iso = (d) => (d ? new Date(d).toISOString() : undefined);

async function getMerchant(merchantId) {
  const m = await Merchant.findOne({ merchantId });
  if (!m) throw httpError(404, 'merchant not found - run npm run seed');
  return m;
}

function maskPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}•• ••${d.slice(-4)}` : '';
}

function merchantView(m) {
  return {
    id: m.merchantId,
    name: m.ownerName || m.name,
    storeName: m.name,
    category: m.category === 'kirana' ? 'Kirana & groceries' : m.category,
    city: m.city || '',
    phoneMasked: maskPhone(m.phone),
  };
}

// A customer is shown as "Cust ****7F" — never a name, phone or UPI ID.
const customerLabel = (p) => `Cust ****${String(p?.customerKey || '').slice(-2).toUpperCase()}`;

// ── Trust settings (app vocabulary ↔ agent families) ─────────────────────────────
//   marketing → marketing (WhatsApp offers) · pricing → loyalty (counter discounts)
//   reorder → restock · loan → credit (always recommend-only)
const toAppMode = (m) => (m === 'recommend' ? 'ask' : m);
const toAgentMode = (m) => (m === 'ask' ? 'recommend' : m);
const SPEND_CAP = { min: 100, max: 2000, step: 100 };
const UNDO_WINDOWS = [15, 30, 60, 120];

function trustView(m) {
  const t = m.settings?.trust || {};
  return {
    modes: {
      marketing: toAppMode(t.marketing || 'recommend'),
      pricing: toAppMode(t.loyalty || 'recommend'),
      reorder: toAppMode(t.restock || 'recommend'),
      loan: 'recommend_only',
    },
    campaignSpendCap: m.settings?.campaignSpendCap ?? 600,
    undoWindowMinutes: m.settings?.undoWindowMinutes ?? 30,
  };
}

async function updateTrust(merchantId, body) {
  const m = await getMerchant(merchantId);
  const modes = body?.modes || {};
  for (const k of ['marketing', 'pricing', 'reorder']) {
    if (!['auto', 'ask', 'off'].includes(modes[k])) throw httpError(422, `invalid mode for ${k}`);
  }
  const cap = body.campaignSpendCap;
  if (!Number.isInteger(cap) || cap < SPEND_CAP.min || cap > SPEND_CAP.max || cap % SPEND_CAP.step !== 0) {
    throw httpError(422, `Spend cap must be ₹${SPEND_CAP.min}–₹${SPEND_CAP.max} in steps of ₹${SPEND_CAP.step}`);
  }
  if (!UNDO_WINDOWS.includes(body.undoWindowMinutes)) throw httpError(422, `Undo window must be one of ${UNDO_WINDOWS.join(', ')} minutes`);
  m.settings.trust.marketing = toAgentMode(modes.marketing);
  m.settings.trust.loyalty = toAgentMode(modes.pricing);
  m.settings.trust.restock = toAgentMode(modes.reorder);
  m.settings.trust.credit = 'recommend'; // loans can never be automatic, whatever the client sends
  m.settings.campaignSpendCap = cap;
  m.settings.undoWindowMinutes = body.undoWindowMinutes;
  await m.save();
  return trustView(m);
}

// ── Counter: payments and today's summary ─────────────────────────────────────────
async function profilesFor(merchantId, keys) {
  const list = await CustomerProfile.find({ merchantId, $or: [{ customerKey: { $in: keys } }, { aliases: { $in: keys } }] }).lean();
  const map = new Map();
  for (const p of list) { map.set(p.customerKey, p); (p.aliases || []).forEach((a) => map.set(a, p)); }
  return map;
}

function paymentView(txn, profile, billId) {
  const visits = profile?.visitCount || 1;
  return {
    id: txn.txnId,
    billId: billId || '',
    amount: txn.amount,
    source: txn.channel === 'CARD_TAP' ? 'card' : 'upi',
    instrumentMasked: txn.channel === 'CARD_TAP' ? `•••• ${String(txn.payerMasked || '').slice(-4)}` : (txn.payerMasked || 'UPI'),
    terminalId: txn.deviceId || 'UPI',
    customer: {
      masked: profile ? customerLabel(profile) : 'New customer',
      visits,
      returning: visits > 1,
      rewardDue: visits > 1 && visits % REWARD_EVERY === 0,
      whatsappOptIn: Boolean(profile?.whatsappOptIn),
    },
    paidAt: iso(txn.settledAt),
  };
}

async function paymentsFromTxns(merchantId, txns) {
  const profiles = await profilesFor(merchantId, txns.map((t) => t.customerKey).filter(Boolean));
  const bills = await Checkout.find({ merchantId, txnId: { $in: txns.map((t) => t.txnId) } }).lean();
  const billOf = new Map(bills.map((b) => [b.txnId, b.checkoutId]));
  return txns.map((t) => paymentView(t, profiles.get(t.customerKey), billOf.get(t.txnId)));
}

async function todaySummary(merchantId, now = new Date()) {
  const since = startOfLocalDay(now);
  const [agg] = await Transaction.aggregate([
    { $match: { merchantId, status: 'SETTLED', settledAt: { $gte: since } } },
    { $group: { _id: null, sales: { $sum: '$amount' }, count: { $sum: 1 }, keys: { $push: '$customerKey' } } },
  ]);
  const recentTxns = await Transaction.find({ merchantId, status: 'SETTLED', settledAt: { $gte: since } }).sort({ settledAt: -1 }).limit(20).lean();
  let returning = 0;
  if (agg?.keys?.length) {
    const profiles = await profilesFor(merchantId, agg.keys.filter(Boolean));
    returning = agg.keys.filter((k) => (profiles.get(k)?.visitCount || 0) > 1).length;
  }
  return {
    date: localParts(now).dayKey,
    sales: Math.round(agg?.sales || 0),
    count: agg?.count || 0,
    returning,
    recent: await paymentsFromTxns(merchantId, recentTxns),
  };
}

async function paymentForTxnId(merchantId, txnId) {
  const txn = await Transaction.findOne({ merchantId, txnId }).lean();
  if (!txn) return null;
  const [payment] = await paymentsFromTxns(merchantId, [txn]);
  return payment;
}

function billView(c) {
  return {
    id: c.checkoutId,
    amount: c.amount,
    upiUri: c.payUrl,
    payUrl: c.payUrl,
    qrSvg: c.qrSvg,
    createdAt: iso(c.createdAt || new Date()),
    expiresAt: iso(c.expiresAt),
  };
}

// ── Actions ──────────────────────────────────────────────────────────────────────
const TYPE_OF = { marketing: 'marketing', loyalty: 'pricing', restock: 'reorder', credit: 'loan' };
const SHOWN_KINDS = ['WHATSAPP_OFFER', 'WINBACK_MESSAGE', 'RESTOCK_ALERT', 'CREDIT_OFFER'];
const DATA_USED = {
  WHATSAPP_OFFER: ['Last 4 weeks of UPI sales by weekday', 'Visit history of your opted-in regulars', 'Results of past offers'],
  WINBACK_MESSAGE: ['Visit history from hashed UPI IDs', 'WhatsApp opt-ins of those customers'],
  RESTOCK_ALERT: ['Item-level sales from your bills (last 7 days)', 'Current shelf stock'],
  CREDIT_OFFER: ['28 days of settlements', 'Week-to-week stability of collections', '14-day cash forecast'],
};

function calculateEmi(principal, ratePa, months) {
  const r = ratePa / 12 / 100;
  const f = (1 + r) ** months;
  return Math.round((principal * r * f) / (f - 1));
}

function loanOffer(limit) {
  const tenureMonths = 12;
  const interestRatePa = 18; // indicative; the lender sets the real rate
  const emi = calculateEmi(limit, interestRatePa, tenureMonths);
  return { lender: 'Paytm lending partner (indicative)', amount: limit, tenureMonths, interestRatePa, emi, totalInterest: emi * tenureMonths - limit };
}

function expectedImpact(a, ev = {}) {
  switch (a.kind) {
    case 'WHATSAPP_OFFER': {
      const gain = Math.round(((ev.avgOtherDays || 0) - (ev.avgOnWeekday || 0)) * 0.5);
      return { label: `About ${inr(gain)} extra on ${ev.weekdayName || 'the slow day'}`, rupees: gain };
    }
    case 'WINBACK_MESSAGE': {
      const gain = Math.round((a.payload?.recipientCount || ev.reachableOnWhatsApp || 0) * (ev.avgTicket || 0) * 0.3);
      return { label: `If 3 in 10 come back: about ${inr(gain)}`, rupees: gain };
    }
    case 'RESTOCK_ALERT':
      return { label: `Avoids about ${inr(ev.salesAtRisk || 0)} of lost sales`, rupees: ev.salesAtRisk || 0 };
    case 'CREDIT_OFFER':
      return { label: `Up to ${inr(ev.indicativeLimit || 0)} working capital`, rupees: ev.indicativeLimit || 0 };
    default:
      return { label: '', rupees: 0 };
  }
}

function statusOf(a) {
  switch (a.status) {
    case 'pending_approval': return 'pending';
    case 'approved': return 'approved';
    case 'rejected': case 'failed': return 'rejected';
    case 'paused': return 'paused';
    case 'undone': return 'undone';
    case 'executed':
      if (a.outcome?.evaluatedAt) return 'completed';
      return a.decidedBy === 'merchant' ? 'approved' : 'auto_done';
    default: return null;
  }
}

function actionView(a, insight, merchant) {
  const status = statusOf(a);
  if (!status || !SHOWN_KINDS.includes(a.kind)) return null;
  const ev = insight?.evidence || {};
  const type = TYPE_OF[a.family] || 'marketing';
  const view = {
    id: String(a._id),
    type,
    title: a.payload?.title || insight?.title || a.kind,
    summary: a.reasoning || insight?.summary || '',
    why: { dataUsed: DATA_USED[a.kind] || [], pattern: insight?.title || a.reasoning || '', confidence: Math.round((a.confidence || 0) * 100) / 100 },
    expectedImpact: expectedImpact(a, ev),
    risk: a.riskTier,
    status,
    recommendOnly: a.family === 'credit',
    createdAt: iso(a.createdAt),
  };
  if (a.executedAt) view.executedAt = iso(a.executedAt);
  if (a.undoUntil) view.undoUntil = iso(a.undoUntil);
  if (a.family === 'marketing') {
    view.costCap = a.payload?.costCap ?? merchant?.settings?.campaignSpendCap ?? 600;
    if (a.executedAt) view.campaignId = `cmp_${a._id}`;
  }
  if (a.kind === 'RESTOCK_ALERT' && Array.isArray(ev.items)) {
    view.costCap = a.payload?.costCap ?? ev.totalCost;
    view.reorderItems = ev.items.map((i) => ({ name: i.item, quantity: `${i.packs} × ${i.packLabel}`, cost: i.cost }));
  }
  if (a.kind === 'CREDIT_OFFER' && ev.indicativeLimit) view.loan = loanOffer(ev.indicativeLimit);
  if (a.outcome?.evaluatedAt) {
    const sign = a.outcome.liftPct > 0 ? '+' : '';
    view.outcome = { label: `${sign}${a.outcome.liftPct}% · ${a.outcome.metric}`, changePct: a.outcome.liftPct, simulated: false };
  }
  return view;
}

async function listActions(merchantId) {
  const merchant = await getMerchant(merchantId);
  const actions = await AgentAction.find({ merchantId, kind: { $in: SHOWN_KINDS }, status: { $ne: 'skipped' } }).sort({ createdAt: -1 }).limit(60).lean();
  const insights = await AgentInsight.find({ _id: { $in: actions.map((a) => a.insightId).filter(Boolean) } }).lean();
  const byId = new Map(insights.map((i) => [String(i._id), i]));
  return actions.map((a) => actionView(a, byId.get(String(a.insightId)), merchant)).filter(Boolean);
}

async function actionById(merchantId, id) {
  const merchant = await getMerchant(merchantId);
  const a = await AgentAction.findOne({ _id: id, merchantId }).lean();
  if (!a) return null;
  const insight = a.insightId ? await AgentInsight.findById(a.insightId).lean() : null;
  return actionView(a, insight, merchant);
}

// ── Insights + morning briefing ──────────────────────────────────────────────────
const KIND_OF = { SALES_DIP: 'sales_dip', DORMANT_REGULARS: 'loyalty', CREDIT_ELIGIBLE: 'credit', LOW_STOCK: 'reorder', SLOW_MOVER: 'reorder' };

function insightView(i, actionId) {
  const ev = i.evidence || {};
  const base = { id: String(i._id), kind: KIND_OF[i.type], title: i.title, detail: i.summary || '', ...(actionId ? { actionId } : {}) };
  switch (i.type) {
    case 'SALES_DIP':
      if (ev.weekdayName) {
        const gain = Math.round(((ev.avgOtherDays || 0) - (ev.avgOnWeekday || 0)) * 0.5);
        return { ...base, impactRupees: gain, impactLabel: `+${inr(gain)} expected`, risk: 'low', ctaLabel: 'See offer' };
      }
      return { ...base, impactRupees: (ev.last7Days || 0) - (ev.previous7Days || 0), impactLabel: `${ev.changePct}% vs last week`, risk: 'medium', ctaLabel: 'Ask Mitra why' };
    case 'DORMANT_REGULARS': {
      const v = (ev.dormantCount || 0) * (ev.avgTicket || 0);
      return { ...base, impactRupees: v, impactLabel: `${inr(v)} to recover`, risk: 'low', ctaLabel: 'See regulars' };
    }
    case 'CREDIT_ELIGIBLE':
      return { ...base, impactRupees: ev.indicativeLimit || 0, impactLabel: `${inr(ev.indicativeLimit || 0)} available`, risk: 'high', ctaLabel: 'Review eligibility' };
    case 'LOW_STOCK':
      return { ...base, impactRupees: ev.salesAtRisk || 0, impactLabel: `${inr(ev.salesAtRisk || 0)} sales protected`, risk: 'medium', ctaLabel: 'Review reorder' };
    case 'SLOW_MOVER':
      return { ...base, impactRupees: 0, impactLabel: 'Order less next time', risk: 'low', ctaLabel: 'See items' };
    default:
      return null;
  }
}

async function insightsView(merchantId, now = new Date()) {
  const snapshot = await buildSnapshot(merchantId, { now });
  const { merchant } = snapshot;
  const trend = tools.analyzeSalesTrend(snapshot).stats;
  const complete = snapshot.daily.filter((d) => d.dayKey < snapshot.todayKey);
  const y = complete.at(-1);
  const lastWeek = complete.at(-8);

  const recent = await AgentInsight.find({
    merchantId, status: { $in: ['open', 'actioned'] }, createdAt: { $gte: new Date(now.getTime() - 7 * 864e5) },
  }).sort({ createdAt: -1 }).lean();
  // Latest finding of each type only.
  const seen = new Map();
  for (const i of recent) if (!seen.has(i.type)) seen.set(i.type, i);
  const latest = [...seen.values()];
  const actions = await AgentAction.find({ insightId: { $in: latest.map((i) => i._id) }, status: { $ne: 'skipped' } }).lean();
  const actionOf = new Map(actions.map((a) => [String(a.insightId), String(a._id)]));
  const list = latest.map((i) => insightView(i, actionOf.get(String(i._id)))).filter(Boolean);

  // Cash crunch comes straight from the live forecast.
  const cash = tools.forecastCashflow(snapshot);
  if (cash.shortfallDayIndex >= 0) {
    const bill = (merchant.cashflow?.payables || [])[0];
    list.splice(Math.min(1, list.length), 0, {
      id: 'ins_cash_crunch',
      kind: 'cash_crunch',
      title: `Cash may run short in ${cash.shortfallDayIndex} day${cash.shortfallDayIndex === 1 ? '' : 's'}`,
      detail: bill ? `${bill.label} of ${inr(bill.amount)} lands before the weekend takings.` : 'Spending is ahead of takings.',
      impactRupees: -cash.gap,
      impactLabel: `${inr(cash.gap)} short`,
      risk: 'high',
      ctaLabel: 'See cashflow',
    });
  }
  list.forEach((x, idx) => { x.rank = idx + 1; });

  const pending = await AgentAction.countDocuments({ merchantId, status: 'pending_approval', kind: { $in: SHOWN_KINDS } });
  const en = (merchant.language || '').startsWith('en');
  const change = trend.yesterdayVsLastWeekPct;
  const dayName = y ? DAY_NAMES[y.weekday] : '';
  const name = merchant.ownerName || merchant.name;
  const spokenSummary = y
    ? (en
      ? `Namaste ${name}. Yesterday's sales were ${inr(y.total)}${change !== null ? `, ${Math.abs(change)}% ${change >= 0 ? 'more' : 'less'} than last ${dayName}` : ''}.${pending ? ` ${pending} thing${pending > 1 ? 's' : ''} need your approval.` : ''}`
      : `Namaste ${name} ji. Kal ki sale ${inr(y.total)} thi${change !== null ? `, pichle ${dayName} se ${Math.abs(change)}% ${change >= 0 ? 'zyada' : 'kam'}` : ''}.${pending ? ` Aapke approval ke liye ${pending} cheezein hain.` : ''}`)
    : `Namaste ${name}.`;

  return {
    briefing: {
      date: now.toISOString(),
      greetingName: name,
      yesterday: {
        dayLabel: dayName,
        sales: Math.round(y?.total || 0),
        comparison: { label: `last ${dayName}`, sales: Math.round(lastWeek?.total || 0), changePct: Math.round(change ?? 0) },
      },
      reasoning: list[0]?.title || 'Business is steady',
      spokenSummary,
    },
    insights: list,
  };
}

// ── Campaigns (executed WhatsApp offers, measured from real payments) ──────────────
async function campaignsView(merchantId) {
  const merchant = await getMerchant(merchantId);
  const acts = await AgentAction.find({
    merchantId, kind: { $in: ['WHATSAPP_OFFER', 'WINBACK_MESSAGE'] }, status: { $in: ['executed', 'paused', 'undone'] },
  }).sort({ executedAt: -1 }).limit(20).lean();
  const out = [];
  for (const a of acts) {
    const ids = a.result?.recipientIds || [];
    const sent = await ChannelMessage.countDocuments({ actionId: a._id, channel: 'whatsapp', status: 'sent' });
    const live = await ChannelMessage.exists({ actionId: a._id, channel: 'whatsapp', mode: 'live' });
    const recipients = await CustomerProfile.find({ _id: { $in: ids } }, { customerKey: 1, aliases: 1, lastSeen: 1 }).lean();
    const redeemed = recipients.filter((r) => r.lastSeen && a.executedAt && r.lastSeen > a.executedAt);
    const keys = redeemed.flatMap((r) => [r.customerKey, ...(r.aliases || [])]);
    const [extra] = keys.length
      ? await Transaction.aggregate([{ $match: { merchantId, customerKey: { $in: keys }, settledAt: { $gt: a.executedAt } } }, { $group: { _id: null, t: { $sum: '$amount' } } }])
      : [];
    const extraSales = Math.round(extra?.t || 0);
    const cap = a.payload?.costCap ?? merchant.settings?.campaignSpendCap ?? 600;
    const winback = a.kind === 'WINBACK_MESSAGE';
    out.push({
      id: `cmp_${a._id}`,
      actionId: String(a._id),
      name: winback ? 'Win-back offer' : `${a.payload?.weekdayName || 'Weekday'} offer`,
      channel: 'whatsapp',
      message: a.payload?.message || '',
      audience: { label: `${sent} ${winback ? 'customers who stopped visiting' : 'regular customers'}`, count: sent },
      // Read receipts need the live WhatsApp API; in mock mode "read" is an estimate.
      funnel: { sent, delivered: sent, read: live ? sent : Math.round(sent * 0.75), redeemed: redeemed.length },
      discountCost: Math.min(cap, Math.round(extraSales * 0.1)),
      extraSales,
      status: a.status === 'paused' ? 'paused' : a.status === 'undone' ? 'stopped' : a.outcome?.evaluatedAt ? 'completed' : 'running',
      simulated: !live,
    });
  }
  return out;
}

// ── Regulars ─────────────────────────────────────────────────────────────────────
async function regularsView(merchantId) {
  const min = config.agent.regularVisitThreshold;
  const filter = { merchantId, visitCount: { $gte: min } };
  const [total, list] = await Promise.all([
    CustomerProfile.countDocuments(filter),
    CustomerProfile.find(filter).sort({ visitCount: -1 }).limit(50).lean(),
  ]);
  return {
    total,
    regulars: list.map((p) => ({
      id: String(p._id),
      masked: customerLabel(p),
      visits: p.visitCount,
      lastVisit: iso(p.lastSeen),
      avgBasket: p.visitCount ? Math.round(p.totalSpend / p.visitCount) : 0,
      reward: { status: p.visitCount % REWARD_EVERY === 0 ? 'earned' : 'progress', everyNVisits: REWARD_EVERY },
      consent: p.whatsappOptIn ? { whatsappOptIn: true, optedInAt: iso(p.createdAt) } : { whatsappOptIn: false },
    })),
  };
}

// ── Outcomes (what changed + what the agent learned) ─────────────────────────────
async function outcomesView(merchantId, now = new Date()) {
  const snapshot = await buildSnapshot(merchantId, { now });
  const complete = snapshot.daily.filter((d) => d.dayKey < snapshot.todayKey);
  const week2 = complete.slice(-7);
  const week1 = complete.slice(-14, -7);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const weekly = order.map((w) => ({
    day: SHORT_DAYS[w],
    week1: Math.round(week1.find((d) => d.weekday === w)?.total || 0),
    week2: Math.round(week2.find((d) => d.weekday === w)?.total || 0),
  }));

  const measured = await AgentAction.findOne({ merchantId, kind: 'WHATSAPP_OFFER', 'outcome.evaluatedAt': { $exists: true } }).sort({ 'outcome.evaluatedAt': -1 }).lean();
  const sum = (a) => Math.round(a.reduce((s, d) => s + d.total, 0));
  const headline = measured
    ? {
      label: `${measured.payload?.weekdayName || 'Offer day'} sales after the offer`,
      before: { label: 'Usual day', sales: Math.round(measured.outcome.baseline) },
      after: { label: measured.payload?.targetDate || 'Offer day', sales: Math.round(measured.outcome.observed) },
      changePct: measured.outcome.liftPct,
      simulated: false,
    }
    : {
      label: 'This week vs last week',
      before: { label: 'Last week', sales: sum(week1) },
      after: { label: 'This week', sales: sum(week2) },
      changePct: sum(week1) ? Math.round(((sum(week2) - sum(week1)) / sum(week1)) * 1000) / 10 : 0,
      simulated: false,
    };

  const names = { WHATSAPP_OFFER: 'Slow-day WhatsApp offers', WINBACK_MESSAGE: 'Win-back messages' };
  const learned = Object.entries(snapshot.learning || {}).map(([kind, s]) =>
    `${names[kind] || kind}: ${s.positive} of ${s.tried} worked, average change ${s.avgLiftPct > 0 ? '+' : ''}${s.avgLiftPct}%.`);
  if (!learned.length) learned.push('No offer has finished its measuring window yet. I check each one 7 days after it runs.');

  const open = await AgentInsight.find({ merchantId, status: 'open' }).sort({ createdAt: -1 }).limit(3).lean();
  const nextWeek = open.map((i) => i.title);
  if (!nextWeek.length) nextWeek.push('Keep watching the slow weekday and repeat what worked.');
  return { headline, learned, nextWeek, weekly };
}

// ── Cashflow ─────────────────────────────────────────────────────────────────────
async function cashflowView(merchantId, now = new Date()) {
  const snapshot = await buildSnapshot(merchantId, { now });
  const f = tools.forecastCashflow(snapshot);
  const [reorder, loan] = await Promise.all([
    AgentAction.findOne({ merchantId, kind: 'RESTOCK_ALERT', status: { $ne: 'skipped' } }).sort({ createdAt: -1 }).lean(),
    AgentAction.findOne({ merchantId, kind: 'CREDIT_OFFER', status: { $ne: 'skipped' } }).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    days: f.days.map(({ date, inflow, outflow, balance }) => ({ date, inflow, outflow, balance })),
    shortfallDayIndex: f.shortfallDayIndex,
    safetyThreshold: f.safetyThreshold,
    reorderActionId: reorder ? String(reorder._id) : '',
    loanActionId: loan ? String(loan._id) : '',
  };
}

// ── Today's pace vs a usual day (for "Run agent now") ────────────────────────────
function pacePct(snapshot, todaySales, now = new Date()) {
  const { hour } = localParts(now);
  const total = snapshot.hourly.reduce((s, h) => s + h.total, 0);
  if (!total) return 0;
  const minute = now.getMinutes() / 60;
  const done = snapshot.hourly.reduce((s, h) => s + (h.hour < hour ? h.total : h.hour === hour ? h.total * minute : 0), 0);
  const complete = snapshot.daily.filter((d) => d.dayKey < snapshot.todayKey);
  const same = complete.filter((d) => d.weekday === snapshot.todayWeekday);
  const usualDay = (same.length ? same : complete).reduce((s, d) => s + d.total, 0) / Math.max(1, (same.length ? same : complete).length);
  const expected = usualDay * (done / total);
  return expected > 0 ? Math.round(((todaySales - expected) / expected) * 100) : 0;
}

module.exports = {
  getMerchant, merchantView, trustView, updateTrust, todaySummary, paymentForTxnId, billView,
  listActions, actionById, actionView, insightsView, campaignsView, regularsView, outcomesView, cashflowView, pacePct,
  TYPE_OF, customerLabel, REWARD_EVERY,
};
