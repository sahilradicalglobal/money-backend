const express = require('express');
const { authRequired } = require('../middleware/auth');
const { listPayments, addPayment, deletePayment } = require('../controllers/paymentsController');

const router = express.Router({ mergeParams: true });
router.use(authRequired);

router.get('/', listPayments);
router.post('/', addPayment);
router.delete('/:paymentId', deletePayment);

module.exports = router;
