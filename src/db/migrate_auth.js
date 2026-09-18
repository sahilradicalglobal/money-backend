require('dotenv').config();
const mysql = require('mysql2/promise');

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function migrateAuth() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'money_collection',
  });

  if (!(await columnExists(conn, 'users', 'business_name'))) {
    await conn.query('ALTER TABLE users ADD COLUMN business_name VARCHAR(255) NULL AFTER email');
    console.log('Added users.business_name');
  }
  if (!(await columnExists(conn, 'users', 'auth_provider'))) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN auth_provider ENUM('EMAIL','GOOGLE') NOT NULL DEFAULT 'EMAIL' AFTER business_name"
    );
    console.log('Added users.auth_provider');
  }
  if (!(await columnExists(conn, 'users', 'profile_url'))) {
    await conn.query('ALTER TABLE users ADD COLUMN profile_url TEXT NULL AFTER email');
    console.log('Added users.profile_url');
  }

  await conn.end();
  console.log('Auth migration complete');
}

migrateAuth().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
