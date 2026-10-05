const crypto = require('crypto');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');

const PRODUCT_ID = 'mlcm_premium_monthly';
const BASE_PLAN_ID = 'monthly';
const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.radicalapp.moneylender';
const ACTIVE_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

const verifyValidators = [
  body('purchaseToken').isString().trim().notEmpty().isLength({ max: 4096 }),
  body('productId').equals(PRODUCT_ID),
  body('basePlanId').equals(BASE_PLAN_ID),
];

function userAccountId(userId) {
  return crypto.createHash('sha256').update(`mlcm:user:${userId}`).digest('hex');
}

function sameString(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function serviceAccountCredentials() {
  const json = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE;
  if (json || file) {
    try {
      return JSON.parse(json || fs.readFileSync(file, 'utf8'));
    } catch {
      const error = new Error('Google Play service-account credentials are invalid or unreadable.');
      error.status = 503;
      throw error;
    }
  }
  const error = new Error('Google Play purchase verification is not configured on the server.');
  error.status = 503;
  throw error;
}

async function verifyWithGoogle(purchaseToken) {
  const auth = new GoogleAuth({
    credentials: serviceAccountCredentials(),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Unable to obtain Google Play Developer API access.');

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/` +
    `${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const error = new Error(
        'Google Play Developer API access is not configured correctly. Check the API and service-account permissions.'
      );
      error.status = 503;
      throw error;
    }
    const error = new Error(
      response.status === 404
        ? 'Google Play did not find this subscription purchase.'
        : 'Google Play could not verify this purchase. Please retry.'
    );
    error.status = response.status === 404 ? 400 : 502;
    throw error;
  }
  return response.json();
}

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(400).json({ success: false, message: 'Invalid subscription verification request.' });
  return false;
}

async function verifyGoogleSubscription(req, res, next) {
  if (!handleValidation(req, res)) return;

  try {
    const { purchaseToken } = req.body;
    const subscription = await verifyWithGoogle(purchaseToken);
    const lineItem = (subscription.lineItems || []).find(
      (item) =>
        item.productId === PRODUCT_ID &&
        item.offerDetails?.basePlanId === BASE_PLAN_ID
    );
    if (!lineItem) {
      return res.status(400).json({
        success: false,
        message: 'The Google Play purchase does not match the configured Premium subscription.',
      });
    }

    const expectedAccountId = userAccountId(req.user.id);
    const playAccountId = subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (!sameString(playAccountId, expectedAccountId)) {
      return res.status(403).json({
        success: false,
        message: 'This Google Play purchase is not linked to the signed-in app account.',
      });
    }

    const expiryMillis = lineItem.expiryTime ? Date.parse(lineItem.expiryTime) : NaN;
    const expiryTime = Number.isFinite(expiryMillis)
      ? new Date(expiryMillis).toISOString().slice(0, 19).replace('T', ' ')
      : null;
    const isPremium =
      ACTIVE_STATES.has(subscription.subscriptionState) &&
      Number.isFinite(expiryMillis) &&
      expiryMillis > Date.now();
    const tokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');

    await query(
      `INSERT INTO google_play_subscriptions
         (user_id, purchase_token_hash, product_id, base_plan_id, subscription_state, expiry_time, updated_at)
       VALUES
         (:userId, :tokenHash, :productId, :basePlanId, :subscriptionState, :expiryTime, :updatedAt)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      {
        userId: req.user.id,
        tokenHash,
        productId: PRODUCT_ID,
        basePlanId: BASE_PLAN_ID,
        subscriptionState: subscription.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED',
        expiryTime,
        updatedAt: Date.now(),
      }
    );
    const owners = await query(
      'SELECT user_id FROM google_play_subscriptions WHERE purchase_token_hash = :tokenHash',
      { tokenHash }
    );
    if (!owners.length || String(owners[0].user_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'This purchase token is already linked to another app account.',
      });
    }
    await query(
      `UPDATE google_play_subscriptions
       SET product_id = :productId, base_plan_id = :basePlanId,
           subscription_state = :subscriptionState, expiry_time = :expiryTime, updated_at = :updatedAt
       WHERE purchase_token_hash = :tokenHash AND user_id = :userId`,
      {
        userId: req.user.id,
        tokenHash,
        productId: PRODUCT_ID,
        basePlanId: BASE_PLAN_ID,
        subscriptionState: subscription.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED',
        expiryTime,
        updatedAt: Date.now(),
      }
    );

    res.json({
      success: true,
      data: {
        verified: true,
        isPremium,
        expiryTime: lineItem.expiryTime || null,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
}

module.exports = { verifyValidators, verifyGoogleSubscription };
