const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  listHistory,
  createHistory,
  deleteHistory,
  getSettings,
  updateSettings,
  dashboardSummary,
} = require('../controllers/miscController');

const router = express.Router();

router.get('/dashboard/summary', authRequired, dashboardSummary);
router.get('/history', authRequired, listHistory);
router.post('/history', authRequired, createHistory);
router.delete('/history/:id', authRequired, deleteHistory);
router.get('/settings', authRequired, getSettings);
router.put('/settings', authRequired, updateSettings);

module.exports = router;
