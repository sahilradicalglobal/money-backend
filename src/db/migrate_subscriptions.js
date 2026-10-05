require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrateSubscriptions() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'money_collection',
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS google_play_subscriptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        purchase_token_hash CHAR(64) NOT NULL,
        product_id VARCHAR(150) NOT NULL,
        base_plan_id VARCHAR(150) NOT NULL,
        subscription_state VARCHAR(64) NOT NULL,
        expiry_time DATETIME NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_google_play_purchase_token (purchase_token_hash),
        KEY idx_google_play_user_expiry (user_id, expiry_time),
        CONSTRAINT fk_google_play_subscription_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('Google Play subscription table is ready');
  } finally {
    await conn.end();
  }
}

migrateSubscriptions().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
