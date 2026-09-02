const bcrypt = require('bcryptjs');
const { verifyGoogleIdToken } = require('../utils/googleAuth');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { signToken } = require('../middleware/auth');
const { nowMs } = require('../utils/helpers');

const registerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const googleValidators = [
  body('idToken').notEmpty().withMessage('Google ID token is required'),
];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

function userPayload(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    businessName: row.business_name || null,
    authProvider: row.auth_provider || 'EMAIL',
  };
}

async function ensureSettings(userId, ts) {
  const existing = await query('SELECT user_id FROM app_settings WHERE user_id = :userId', { userId });
  if (!existing.length) {
    await query(
      `INSERT INTO app_settings (user_id, updated_at) VALUES (:userId, :updatedAt)`,
      { userId, updatedAt: ts }
    );
  }
}

async function register(req, res, next) {
  try {
    if (!handleValidation(req, res)) return;

    const { name, email, password, businessName } = req.body;
    const existing = await query('SELECT id FROM users WHERE email = :email', { email });
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ts = nowMs();
    const result = await query(
      `INSERT INTO users (name, email, business_name, auth_provider, password_hash, created_at, updated_at)
       VALUES (:name, :email, :businessName, 'EMAIL', :passwordHash, :createdAt, :updatedAt)`,
      {
        name,
        email,
        businessName: businessName || null,
        passwordHash,
        createdAt: ts,
        updatedAt: ts,
      }
    );

    const userId = result.insertId;
    await ensureSettings(userId, ts);

    const token = signToken({ userId, email });
    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: userId, name, email, businessName: businessName || null, authProvider: 'EMAIL' },
        isNewUser: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    if (!handleValidation(req, res)) return;

    const { email, password } = req.body;
    const rows = await query(
      'SELECT id, name, email, business_name, auth_provider, password_hash FROM users WHERE email = :email',
      { email }
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      success: true,
      data: { token, user: userPayload(user), isNewUser: false },
    });
  } catch (err) {
    next(err);
  }
}

/** Google Sign-In — verify ID token, create if missing, otherwise login. */
async function googleAuth(req, res, next) {
  try {
    if (!handleValidation(req, res)) return;

    const { idToken } = req.body;
    let googleUser;
    try {
      googleUser = await verifyGoogleIdToken(idToken);
    } catch (err) {
      const status = err.status || 401;
      return res.status(status).json({
        success: false,
        message: err.message || 'Invalid Google sign-in token',
      });
    }

    const { name, email } = googleUser;
    const rows = await query(
      'SELECT id, name, email, business_name, auth_provider FROM users WHERE email = :email',
      { email }
    );
    const ts = nowMs();

    if (rows.length) {
      const user = rows[0];
      const token = signToken({ userId: user.id, email: user.email });
      return res.json({
        success: true,
        data: { token, user: userPayload(user), isNewUser: false },
      });
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const result = await query(
      `INSERT INTO users (name, email, business_name, auth_provider, password_hash, created_at, updated_at)
       VALUES (:name, :email, NULL, 'GOOGLE', :passwordHash, :createdAt, :updatedAt)`,
      { name, email, passwordHash, createdAt: ts, updatedAt: ts }
    );
    const userId = result.insertId;
    await ensureSettings(userId, ts);
    const token = signToken({ userId, email });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: userId, name, email, businessName: null, authProvider: 'GOOGLE' },
        isNewUser: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function profile(req, res, next) {
  try {
    const rows = await query(
      'SELECT id, name, email, business_name, auth_provider, created_at, updated_at FROM users WHERE id = :id',
      { id: req.user.id }
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const u = rows[0];
    res.json({
      success: true,
      data: {
        ...userPayload(u),
        createdAt: Number(u.created_at),
        updatedAt: Number(u.updated_at),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, businessName } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const ts = nowMs();
    await query(
      `UPDATE users SET name = :name, business_name = :businessName, updated_at = :updatedAt
       WHERE id = :id`,
      {
        id: req.user.id,
        name: String(name).trim(),
        businessName: businessName ? String(businessName).trim() : null,
        updatedAt: ts,
      }
    );
    const rows = await query(
      'SELECT id, name, email, business_name, auth_provider FROM users WHERE id = :id',
      { id: req.user.id }
    );
    res.json({ success: true, data: userPayload(rows[0]) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerValidators,
  loginValidators,
  googleValidators,
  register,
  login,
  googleAuth,
  profile,
  updateProfile,
};
