const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  verifyValidators,
  verifyGoogleSubscription,
} = require('../controllers/subscriptionController');

const router = express.Router();

router.post('/google/verify', authRequired, verifyValidators, verifyGoogleSubscription);

module.exports = router;
