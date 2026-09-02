require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { pool, testConnection } = require('./src/config/database');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth.routes');
const recordsRoutes = require('./src/routes/records.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const miscRoutes = require('./src/routes/misc.routes');
const syncRoutes = require('./src/routes/sync.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'API is running', database: 'connected' });
  } catch {
    res.status(503).json({ success: false, message: 'API running but database disconnected' });
  }
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Money Collection API',
    version: '1.0.0',
    note: 'Data sync only — interest calculations stay on the Android app',
    endpoints: {
      auth: '/api/auth',
      records: '/api/records',
      payments: '/api/records/:recordId/payments',
      dashboard: '/api/dashboard/summary',
      sync: '/api/sync/backup',
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/records/:recordId/payments', paymentsRoutes);
app.use('/api', miscRoutes);
app.use('/api/sync', syncRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Money Collection API running on http://localhost:${PORT}`);

  try {
    const db = await testConnection();
    console.log('✅ Database connected successfully!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check .env settings (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)');
  }
});

module.exports = app;
