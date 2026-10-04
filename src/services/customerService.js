const { CustomerProfile } = require('../models');
const config = require('../config');

function segmentFor(profile, now = new Date()) {
  const { regularVisitThreshold, dormantAfterDays } = config.agent;
  const daysSince = profile.lastSeen ? (now - profile.lastSeen) / 864e5 : Infinity;
  if (profile.visitCount >= regularVisitThreshold && daysSince > dormantAfterDays) return 'dormant';
  if (profile.visitCount >= regularVisitThreshold) return 'regular';
  if (profile.visitCount > 1) return 'returning';
  return 'new';
}

// Resolve any identity hash (UPI or RFID) to a single customer profile.
async function findByIdentity(merchantId, identityHash) {
  return CustomerProfile.findOne({
    merchantId,
    $or: [{ customerKey: identityHash }, { aliases: identityHash }],
  });
}

// Called for every settled transaction — this is the agent's continuous "Observe".
async function recordVisit({ merchantId, identityHash, amount, payerMasked, cardMasked, at = new Date() }) {
  let profile = await findByIdentity(merchantId, identityHash);
  if (!profile) {
    profile = new CustomerProfile({ merchantId, customerKey: identityHash, aliases: [], firstSeen: at, payerMasked });
  }
  // Remember when we saw them before this visit — the real-time POS nudge uses it
  // to spot a lapsed regular walking back in.
  profile.$locals.prevLastSeen = profile.lastSeen || null;
  profile.visitCount += 1;
  profile.totalSpend += amount;
  if (cardMasked && !profile.cardsMasked.includes(cardMasked)) profile.cardsMasked.push(cardMasked);
  if (!profile.lastSeen || at > profile.lastSeen) profile.lastSeen = at;
  if (!profile.firstSeen || at < profile.firstSeen) profile.firstSeen = at;
  profile.segment = segmentFor(profile, at);
  await profile.save();
  return profile;
}

// Link an RFID card to an existing UPI-identified customer (done once at the counter).
async function linkIdentity(merchantId, primaryKey, aliasHash, cardMasked) {
  const profile = await findByIdentity(merchantId, primaryKey);
  if (!profile) return null;
  if (!profile.aliases.includes(aliasHash)) profile.aliases.push(aliasHash);
  if (cardMasked && !profile.cardsMasked.includes(cardMasked)) profile.cardsMasked.push(cardMasked);
  await profile.save();
  // If the card had already built up its own profile, fold it in.
  const orphan = await CustomerProfile.findOne({ merchantId, customerKey: aliasHash });
  if (orphan && String(orphan._id) !== String(profile._id)) {
    profile.visitCount += orphan.visitCount;
    profile.totalSpend += orphan.totalSpend;
    if (orphan.lastSeen && (!profile.lastSeen || orphan.lastSeen > profile.lastSeen)) profile.lastSeen = orphan.lastSeen;
    if (orphan.firstSeen && (!profile.firstSeen || orphan.firstSeen < profile.firstSeen)) profile.firstSeen = orphan.firstSeen;
    for (const c of orphan.cardsMasked || []) if (!profile.cardsMasked.includes(c)) profile.cardsMasked.push(c);
    profile.segment = segmentFor(profile);
    await profile.save();
    await orphan.deleteOne();
  }
  return profile;
}

// Nightly refresh so "regular" customers who stopped coming become "dormant".
async function refreshSegments(merchantId) {
  const profiles = await CustomerProfile.find({ merchantId });
  let changed = 0;
  for (const p of profiles) {
    const seg = segmentFor(p);
    if (seg !== p.segment) { p.segment = seg; await p.save(); changed += 1; }
  }
  return changed;
}

module.exports = { segmentFor, findByIdentity, recordVisit, linkIdentity, refreshSegments };
