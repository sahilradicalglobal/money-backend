-- Optional columns for profile / Google auth (safe to re-run)
USE money_collection;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(255) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS auth_provider ENUM('EMAIL','GOOGLE') NOT NULL DEFAULT 'EMAIL' AFTER business_name;

-- Allow Google users without a real password (placeholder hash stored)
-- password_hash stays NOT NULL; Google auth inserts a random hash.
