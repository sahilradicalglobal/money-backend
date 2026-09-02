const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  registerValidators,
  loginValidators,
  googleValidators,
  register,
  login,
  googleAuth,
  profile,
  updateProfile,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);
router.post('/google', googleValidators, googleAuth);
router.get('/profile', authRequired, profile);
router.put('/profile', authRequired, updateProfile);

module.exports = router;
