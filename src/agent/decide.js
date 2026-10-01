// ③ DECIDE — the trust engine. Pure function: given a proposed action, the merchant's
// permissions and the current context, return auto / recommend / skip plus a trace of
// every rule that was checked. The trace is stored with the action (audit trail).
//
// Principle: the merchant sets the rules. Low-risk actions MAY auto-execute; high-stakes
// actions (credit) are ALWAYS recommend-only, whatever the settings say.

const COOLDOWN_HOURS = { marketing: 72, loyalty: 0, restock: 24, credit: 24 * 7, info: 20 };
const MIN_AUTO_CONFIDENCE = 0.6;

function inQuietHours(hour, { start, end }) {
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

function decide(action, merchant, ctx) {
  const trace = [];
  const settings = merchant.settings || {};
  const setting = settings.trust?.[action.family] || 'recommend';
  const step = (rule, result, detail) => { trace.push({ rule, result, detail }); };

  // 1. Merchant switched this family off entirely.
  if (setting === 'off') { step('family-enabled', 'fail', `${action.family} is turned off by merchant`); return { mode: 'skip', trace }; }
  step('family-enabled', 'pass', `${action.family}=${setting}`);

  // 2. Cooldown — don't repeat the same kind of action too often.
  const cooldown = COOLDOWN_HOURS[action.family] ?? 24;
  const recentSame = (ctx.recentActions || []).find((a) => a.kind === action.kind
    && ['executed', 'pending_approval', 'approved'].includes(a.status)
    && (ctx.now - new Date(a.createdAt)) / 36e5 < cooldown);
  if (cooldown > 0 && recentSame) {
    step('cooldown', 'fail', `a ${action.kind} is already ${recentSame.status} within ${cooldown}h`);
    return { mode: 'skip', trace };
  }
  step('cooldown', 'pass', `no ${action.kind} in last ${cooldown}h`);

  // 3. Hard lock: high-risk / financial actions always need a human.
  if (action.riskTier === 'high' || action.family === 'credit') {
    step('risk-lock', 'recommend', 'high-stakes action — human approval always required');
    return { mode: 'recommend', trace };
  }
  step('risk-lock', 'pass', `riskTier=${action.riskTier}`);

  // 4. Merchant preference.
  if (setting !== 'auto') { step('merchant-permission', 'recommend', `${action.family} set to recommend`); return { mode: 'recommend', trace }; }
  step('merchant-permission', 'pass', `${action.family} allowed to auto-execute`);

  // 5. Confidence floor.
  if ((action.confidence ?? 0) < MIN_AUTO_CONFIDENCE) {
    step('confidence', 'recommend', `confidence ${action.confidence?.toFixed(2)} < ${MIN_AUTO_CONFIDENCE}`);
    return { mode: 'recommend', trace };
  }
  step('confidence', 'pass', `confidence ${action.confidence.toFixed(2)}`);

  // 6. Learned track record: if this kind of action hasn't been working, ask first.
  const stats = ctx.learning?.[action.kind];
  if (stats && stats.tried >= 3 && stats.positive / stats.tried < 0.34) {
    step('track-record', 'recommend', `only ${stats.positive}/${stats.tried} past ${action.kind} worked`);
    return { mode: 'recommend', trace };
  }
  step('track-record', 'pass', stats ? `${stats.positive}/${stats.tried} worked` : 'no history yet');

  // 7. Customer-facing guardrails: quiet hours and daily message cap.
  if (action.customerFacing) {
    const qh = settings.quietHours || { start: 21, end: 8 };
    if (inQuietHours(ctx.localHour, qh)) {
      step('quiet-hours', 'recommend', `local hour ${ctx.localHour} is inside quiet hours ${qh.start}-${qh.end}`);
      return { mode: 'recommend', trace };
    }
    step('quiet-hours', 'pass', `local hour ${ctx.localHour}`);
    const cap = settings.maxAutoMessagesPerDay ?? 100;
    const projected = (ctx.autoMessagesToday || 0) + (action.recipientCount || 0);
    if (projected > cap) {
      step('daily-cap', 'recommend', `${projected} messages would exceed daily cap ${cap}`);
      return { mode: 'recommend', trace };
    }
    step('daily-cap', 'pass', `${projected}/${cap} messages today`);
  }

  return { mode: 'auto', trace };
}

module.exports = { decide, inQuietHours, MIN_AUTO_CONFIDENCE, COOLDOWN_HOURS };
