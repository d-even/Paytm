const { Router } = require('express');
const requireApiKey = require('../middleware/apiKey');
const { Merchant, CustomerProfile } = require('../models');
const { hashIdentity } = require('../utils/crypto');
const { need } = require('../utils/validate');

const router = Router();
router.use(requireApiKey);

// Onboard a merchant (in production this comes from Paytm's merchant master).
router.post('/merchants', async (req, res) => {
  need(req.body, ['merchantId', 'name']);
  const { merchantId, name, ownerName, category, city, phone, language, soundboxDeviceId, posDeviceIds } = req.body;
  const merchant = await Merchant.findOneAndUpdate(
    { merchantId },
    { $set: { name, ownerName, category, city, phone, language, soundboxDeviceId, posDeviceIds } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
  );
  res.status(201).json(merchant);
});

router.get('/merchants/:merchantId', async (req, res) => {
  const merchant = await Merchant.findOne({ merchantId: req.params.merchantId }).lean();
  if (!merchant) return res.status(404).json({ error: 'merchant not found' });
  res.json(merchant);
});

// Customer opts in to WhatsApp offers (e.g. by scanning a QR at the counter).
// Nobody is ever messaged without this.
router.post('/customers/opt-in', async (req, res) => {
  need(req.body, ['merchantId', 'payerVpa', 'phone']);
  const key = hashIdentity('upi', req.body.payerVpa);
  const profile = await CustomerProfile.findOneAndUpdate(
    { merchantId: req.body.merchantId, $or: [{ customerKey: key }, { aliases: key }] },
    { $set: { phone: String(req.body.phone), whatsappOptIn: req.body.optIn !== false, displayName: req.body.displayName } },
    { returnDocument: 'after' }
  );
  if (!profile) return res.status(404).json({ error: 'customer has not paid this merchant yet' });
  res.json({ whatsappOptIn: profile.whatsappOptIn, segment: profile.segment, visitCount: profile.visitCount });
});

module.exports = router;
