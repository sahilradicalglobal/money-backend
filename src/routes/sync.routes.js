const express = require('express');
const { authRequired } = require('../middleware/auth');
const { exportBackup, importBackup } = require('../controllers/syncController');

const router = express.Router();
router.use(authRequired);

router.get('/backup', exportBackup);
router.post('/backup', importBackup);

module.exports = router;
