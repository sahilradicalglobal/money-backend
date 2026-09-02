/**
 * Seeds MySQL with 1 test user + 5 loan records + sample payments.
 * Run: npm run db:seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DEMO_EMAIL = 'demo@moneycalc.com';
const DEMO_PASSWORD = '123456';

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'money_collection',
  });

  console.log('Seeding database...');

  const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);
  let userId;

  const ts = Date.now();

  if (existing.length) {
    userId = existing[0].id;
    console.log('Demo user exists, id =', userId);
    await conn.execute('DELETE FROM money_records WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM calculation_history WHERE user_id = ?', [userId]);
  } else {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const [result] = await conn.execute(
      'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)',
      ['Demo User', DEMO_EMAIL, hash, ts, ts]
    );
    userId = result.insertId;
    await conn.execute(
      `INSERT INTO app_settings (user_id, currency, theme, updated_at) VALUES (?, 'INR', 'SYSTEM', ?)`,
      [userId, ts]
    );
    console.log('Created demo user id =', userId);
  }

  const records = [
    {
      name: 'Demo: Rajesh (Simple)',
      direction: 'GIVEN',
      principal: 10000,
      interest_type: 'SIMPLE',
      rate: 10,
      rate_period: 'YEARLY',
      total_interest: 2000,
      total_amount: 12000,
      paid_amount: 2000,
      remaining_amount: 10000,
      duration: '2 years',
      duration_value: '2',
      duration_unit: 'YEARS',
    },
    {
      name: 'Demo: Priya (Flat)',
      direction: 'GIVEN',
      principal: 9000,
      interest_type: 'FLAT',
      rate: 15.5,
      rate_period: 'YEARLY',
      total_interest: 232.5,
      total_amount: 9232.5,
      paid_amount: 0,
      remaining_amount: 9232.5,
      duration: '2 months',
      duration_value: '2',
      duration_unit: 'MONTHS',
    },
    {
      name: 'Demo: Amit (Fixed Monthly)',
      direction: 'GIVEN',
      principal: 10000,
      interest_type: 'MONTHLY',
      rate: 2,
      rate_period: 'MONTHLY',
      total_interest: 1000,
      total_amount: 11000,
      paid_amount: 2200,
      remaining_amount: 8800,
      duration: '5 months',
      duration_value: '5',
      duration_unit: 'MONTHS',
    },
    {
      name: 'Demo: Sunita (Compound)',
      direction: 'GIVEN',
      principal: 10000,
      interest_type: 'COMPOUND',
      rate: 10,
      rate_period: 'YEARLY',
      total_interest: 2100,
      total_amount: 12100,
      paid_amount: 0,
      remaining_amount: 12100,
      duration: '2 years',
      duration_value: '2',
      duration_unit: 'YEARS',
    },
    {
      name: 'Demo: Vikram (EMI)',
      direction: 'GIVEN',
      principal: 25500,
      interest_type: 'EMI',
      rate: 14.5,
      rate_period: 'MONTHLY',
      total_interest: 29751.25,
      total_amount: 55251.25,
      paid_amount: 4604.26,
      remaining_amount: 50646.99,
      duration: '12 months',
      duration_value: '12',
      duration_unit: 'MONTHS',
    },
  ];

  const recordIds = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const [res] = await conn.execute(
      `INSERT INTO money_records (
        user_id, local_id, name, direction, principal, interest_type, rate, rate_period,
        start_date, due_date, total_interest, total_amount, paid_amount, remaining_amount,
        status, duration_description, duration_value, duration_unit, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId, i + 1, r.name, r.direction, r.principal, r.interest_type, r.rate, r.rate_period,
        '2026-01-01', '2027-01-01', r.total_interest, r.total_amount, r.paid_amount,
        r.remaining_amount, r.paid_amount >= r.total_amount ? 'COMPLETED' : 'PENDING',
        r.duration, r.duration_value, r.duration_unit, ts + i, ts + i,
      ]
    );
    recordIds.push(res.insertId);
  }

  const payments = [
    { recordIdx: 0, amount: 2000, method: 'UPI', note: 'Partial payment' },
    { recordIdx: 2, amount: 2200, method: 'CASH', note: '1st installment' },
    { recordIdx: 4, amount: 4604.26, method: 'UPI', note: 'EMI month 1' },
  ];

  for (const p of payments) {
    await conn.execute(
      `INSERT INTO payments (user_id, record_id, amount, pay_date, method, note, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, recordIds[p.recordIdx], p.amount, '2026-02-01', p.method, p.note, ts]
    );
  }

  await conn.execute(
    `INSERT INTO calculation_history (user_id, type, principal, rate, rate_period, duration, result_interest, result_total, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [userId, 'SIMPLE', 10000, 10, 'YEARLY', '2 years', 2000, 12000, ts]
  );

  const [[counts]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM money_records) AS records,
      (SELECT COUNT(*) FROM payments) AS payments,
      (SELECT COUNT(*) FROM calculation_history) AS history,
      (SELECT COUNT(*) FROM app_settings) AS settings
  `);

  console.log('\n=== Seed Complete ===');
  console.log('Login:', DEMO_EMAIL, '/', DEMO_PASSWORD);
  console.log('Counts:', counts);
  console.log('\nVerify in MySQL:');
  console.log('  SELECT * FROM money_records;');
  console.log('  SELECT * FROM payments;');

  await conn.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
