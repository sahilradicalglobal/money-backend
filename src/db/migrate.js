const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Running MySQL migration...');
  await connection.query(sql);
  await connection.end();
  console.log('Migration complete. Database ready:', process.env.DB_NAME || 'money_collection');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
