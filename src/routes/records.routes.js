const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} = require('../controllers/recordsController');

const router = express.Router();
router.use(authRequired);

router.get('/', listRecords);
router.get('/:id', getRecord);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

module.exports = router;
