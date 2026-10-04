// Impact: what the shop's own payments say, built only from rows read out of MongoDB.
// Pure function (no DB, no clock of its own) so it is unit-tested with plain arrays.
//
//   after  = the last 7 days (today included)
//   before = the 7 days before that
//
// Nothing is estimated or simulated: with no payments the numbers are zero and `hasData` is false.
const { localParts, DAY_NAMES, DAY_NAMES_HI } = require('../utils/time');

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon … Sun
const DAY_MS = 864e5;

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const sum = (rows, pick) => rows.reduce((s, r) => s + pick(r), 0);

// Local (IST) day keys, oldest first, ending with the day containing `now`.
function lastDays(now, n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getTime() - (n - 1 - i) * DAY_MS);
    const { dayKey, weekday } = localParts(d);
    return { dayKey, weekday };
  });
}

/**
 * @param {object}   a
 * @param {Array}    a.txns          settled transactions of the last 14 local days: { amount, channel, customerKey, settledAt }
 * @param {Map}      a.visitsOf      customerKey → lifetime visit count (from the customer profiles)
 * @param {object}   a.offers        { sent, redeemed, extraSales, weekdays: number[] } — WhatsApp offers the agent ran
 * @param {Array}    a.learning      [{ kind, tried, positive, avgLiftPct }] — offers whose result has been measured
 * @param {string[]} a.insightTitles titles of the agent's open suggestions, newest first
 * @param {Date}     a.now
 * @param {string}   a.lang          'en' or anything else (Hinglish)
 */
function buildImpact({ txns, visitsOf = new Map(), offers = {}, learning = [], insightTitles = [], now = new Date(), lang = 'hinglish' }) {
  const en = lang === 'en';
  const days = lastDays(now, 14);
  const prevKeys = new Set(days.slice(0, 7).map((d) => d.dayKey));
  const lastKeys = new Set(days.slice(7).map((d) => d.dayKey));

  const rows = txns.map((t) => ({ ...t, ...localParts(new Date(t.settledAt)) }));
  const prev = rows.filter((r) => prevKeys.has(r.dayKey));
  const last = rows.filter((r) => lastKeys.has(r.dayKey));
  const prevSales = Math.round(sum(prev, (r) => r.amount));
  const lastSales = Math.round(sum(last, (r) => r.amount));

  // Per weekday, previous week vs this week (each weekday occurs exactly once in each window).
  const byWeekday = (list) => {
    const m = new Array(7).fill(0);
    for (const r of list) m[r.weekday] += r.amount;
    return m;
  };
  const w1 = byWeekday(prev);
  const w2 = byWeekday(last);
  const offerDays = new Set(offers.weekdays || []);
  const weekly = WEEK_ORDER.map((w) => ({
    day: SHORT_DAYS[w],
    week1: Math.round(w1[w]),
    week2: Math.round(w2[w]),
    ...(offerDays.has(w) ? { offerDay: true } : {}),
  }));

  const customers = new Set(last.map((r) => r.customerKey).filter(Boolean));
  const repeat = [...customers].filter((k) => (visitsOf.get(k) || 0) > 1).length;
  const cardPayments = last.filter((r) => r.channel === 'CARD_TAP').length;
  const stats = {
    sales: lastSales,
    payments: last.length,
    customers: customers.size,
    repeatCustomers: repeat,
    repeatRatePct: pct(repeat, customers.size),
    avgTicket: last.length ? Math.round(lastSales / last.length) : 0,
    cardSharePct: pct(cardPayments, last.length),
    offersSent: offers.sent || 0,
    offersRedeemed: offers.redeemed || 0,
    extraSales: offers.extraSales || 0,
  };

  const headline = {
    label: en ? 'Last 7 days vs the 7 days before' : 'Pichle 7 din vs usse pehle ke 7 din',
    before: { label: en ? 'Previous 7 days' : 'Usse pehle ke 7 din', sales: prevSales },
    after: { label: en ? 'Last 7 days' : 'Pichle 7 din', sales: lastSales },
    // No baseline yet → no percentage (0 would read as "no change").
    changePct: prevSales > 0 ? Math.round(((lastSales - prevSales) / prevSales) * 1000) / 10 : null,
    simulated: false,
  };

  const hasData = rows.length > 0;
  const dayName = (w) => (en ? DAY_NAMES[w] : DAY_NAMES_HI[w]);
  const sold = WEEK_ORDER.filter((w) => w2[w] > 0);
  const best = sold.reduce((m, w) => (m === undefined || w2[w] > w2[m] ? w : m), undefined);
  const slow = sold.reduce((m, w) => (m === undefined || w2[w] < w2[m] ? w : m), undefined);

  const learned = [];
  if (!hasData) {
    learned.push(en
      ? 'No payments yet. Take a payment at the counter and Mitra starts learning from it.'
      : 'Abhi tak koi payment nahi aaya. Counter par payment lijiye, Mitra usse seekhna shuru karega.');
  } else {
    if (best !== undefined) {
      learned.push(en ? `Best day in the last 7 days: ${dayName(best)} (${inr(w2[best])}).` : `Pichle 7 din ka sabse accha din: ${dayName(best)} (${inr(w2[best])}).`);
    }
    if (slow !== undefined && slow !== best) {
      learned.push(en ? `Slowest day with sales: ${dayName(slow)} (${inr(w2[slow])}).` : `Sabse slow din: ${dayName(slow)} (${inr(w2[slow])}).`);
    }
    if (stats.customers > 0) {
      learned.push(en
        ? `${repeat} of ${stats.customers} customers have paid here more than once.`
        : `${stats.customers} mein se ${repeat} customers ek se zyada baar aaye hain.`);
    }
    if (stats.cardSharePct !== null && stats.payments > 0) {
      learned.push(en
        ? `${stats.cardSharePct}% of payments were card taps, ${100 - stats.cardSharePct}% UPI or QR. Average bill ${inr(stats.avgTicket)}.`
        : `${stats.cardSharePct}% payment card tap se hui, ${100 - stats.cardSharePct}% UPI ya QR se. Average bill ${inr(stats.avgTicket)}.`);
    }
  }
  const names = { WHATSAPP_OFFER: en ? 'Slow-day WhatsApp offers' : 'Slow-day WhatsApp offers', WINBACK_MESSAGE: en ? 'Win-back messages' : 'Win-back messages' };
  for (const l of learning) {
    const lift = `${l.avgLiftPct > 0 ? '+' : ''}${l.avgLiftPct}%`;
    learned.push(en
      ? `${names[l.kind] || l.kind}: ${l.positive} of ${l.tried} worked, average change ${lift}.`
      : `${names[l.kind] || l.kind}: ${l.tried} mein se ${l.positive} chale, average change ${lift}.`);
  }
  if (stats.offersSent > 0) {
    learned.push(en
      ? `${stats.offersSent} WhatsApp offers sent. ${stats.offersRedeemed} customers came back, ${inr(stats.extraSales)} in sales since.`
      : `${stats.offersSent} WhatsApp offers bheje. ${stats.offersRedeemed} customers wapas aaye, tab se ${inr(stats.extraSales)} ki sale.`);
  }

  const nextWeek = insightTitles.slice(0, 3);
  if (slow !== undefined && best !== undefined && slow !== best && w2[slow] < w2[best] * 0.7 && !offerDays.has(slow)) {
    nextWeek.push(en
      ? `Try a small offer on ${dayName(slow)}, your slowest day so far.`
      : `${dayName(slow)} ko chhota offer try karein, abhi tak ka sabse slow din.`);
  }
  if (!nextWeek.length) {
    nextWeek.push(hasData
      ? (en ? 'Keep taking payments. Mitra needs a few more days of sales before it can suggest an offer.' : 'Payments lete rahiye. Offer sujhane se pehle Mitra ko kuch aur din ki sale chahiye.')
      : (en ? 'Create your first bill. Mitra starts suggesting things once payments come in.' : 'Pehla bill banaiye. Payments aate hi Mitra sujhaav dena shuru karega.'));
  }

  return { hasData, headline, learned, nextWeek, weekly, stats };
}

module.exports = { buildImpact, lastDays };
