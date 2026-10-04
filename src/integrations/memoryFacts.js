// The sentences Vyapaar Mitra writes into its long-term memory (Cognee turns them into a knowledge graph:
// customer → pays on Tuesdays → buys milk; offer → sent on Tuesday → sales changed by +6%).
// Pure functions. Only names the shop itself gave a customer, or a masked id, ever appear: never a raw card or UPI id.
const { localParts, DAY_NAMES } = require('../utils/time');

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const when = (d) => { const p = localParts(new Date(d)); return `${DAY_NAMES[p.weekday]} ${p.dayKey}`; };
const hourWord = (h) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night');

// The name the shop gave the customer, else a short pseudonym from the hashed customer key (stable, so the graph can tell
// customers apart) — never the masked UPI id or card, which still contain pieces of the real identifier.
function customerLabel(customer, txn = {}) {
  if (customer?.displayName) return customer.displayName;
  const key = String(txn.customerKey || customer?.customerKey || '').replace(/[^a-f0-9]/gi, '').slice(0, 6);
  return key ? `Customer ${key}` : 'A customer';
}

function paymentFact({ merchantName, txn, customer }) {
  const at = txn.settledAt || new Date();
  const p = localParts(new Date(at));
  const who = customerLabel(customer, txn);
  const how = txn.channel === 'CARD_TAP' ? 'a card tap' : 'UPI';
  const items = (txn.items || []).filter((i) => i?.name).map((i) => i.name);
  const visit = customer?.visitCount ? `, visit number ${customer.visitCount}` : '';
  return `${who} paid ${inr(txn.amount)} by ${how} at ${merchantName} on ${when(at)} in the ${hourWord(p.hour)}${visit}${items.length ? `, buying ${items.join(', ')}` : ''}.`;
}

function offerFact({ merchantName, action, result, at = new Date() }) {
  const kind = action.kind === 'WINBACK_MESSAGE' ? 'win-back message' : 'WhatsApp offer';
  const audience = action.payload?.audience === 'dormant' ? 'customers who stopped visiting' : 'regular customers';
  const target = action.payload?.targetDate ? `, aimed at the sales on ${action.payload.targetDate}` : '';
  return `On ${when(at)} ${merchantName} sent a ${kind} to ${result?.sent ?? '?'} ${audience}${target}: "${String(action.payload?.message || '').slice(0, 200)}".`;
}

function outcomeFact({ merchantName, action, outcome }) {
  const kind = action.kind === 'WINBACK_MESSAGE' ? 'win-back message' : 'WhatsApp offer';
  const lift = `${outcome.liftPct > 0 ? '+' : ''}${outcome.liftPct}%`;
  const res = { positive: 'it worked', negative: 'it did not work', neutral: 'the effect was too small to tell' }[outcome.verdict] || outcome.verdict;
  return `Result for ${merchantName}: the ${kind} sent on ${when(action.executedAt || new Date())} was measured on ${outcome.metric}, ${outcome.baseline} before and ${outcome.observed} after (${lift}), so ${res}.`;
}

module.exports = { paymentFact, offerFact, outcomeFact, customerLabel };
