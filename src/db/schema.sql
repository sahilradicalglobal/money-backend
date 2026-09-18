-- Money Collection API — MySQL Schema
-- Stores pre-calculated values from the Android app (no calculation on server).

CREATE DATABASE IF NOT EXISTS money_collection
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE money_collection;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)    NOT NULL,
  email         VARCHAR(191)    NOT NULL,
  profile_url   TEXT            NULL,
  business_name VARCHAR(255)    NULL,
  auth_provider ENUM('EMAIL','GOOGLE') NOT NULL DEFAULT 'EMAIL',
  password_hash VARCHAR(255)    NOT NULL,
  created_at    BIGINT          NOT NULL,
  updated_at    BIGINT          NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS money_records (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              BIGINT UNSIGNED NOT NULL,
  local_id             BIGINT          NULL COMMENT 'Android Room id for sync',
  name                 VARCHAR(255)    NULL,
  direction            ENUM('GIVEN','RECEIVED') NOT NULL,
  principal            DECIMAL(18,2)   NOT NULL,
  interest_type        VARCHAR(32)     NOT NULL,
  rate                 DECIMAL(18,6)   NOT NULL,
  rate_period          ENUM('DAILY','MONTHLY','YEARLY') NULL,
  start_date           DATE            NULL,
  due_date             DATE            NULL,
  total_interest       DECIMAL(18,2)   NOT NULL DEFAULT 0,
  total_amount         DECIMAL(18,2)   NOT NULL,
  paid_amount          DECIMAL(18,2)   NOT NULL DEFAULT 0,
  remaining_amount     DECIMAL(18,2)   NOT NULL,
  status               ENUM('PENDING','COMPLETED') NOT NULL DEFAULT 'PENDING',
  notes                TEXT            NULL,
  duration_description VARCHAR(255)    NULL,
  duration_value       VARCHAR(64)     NULL,
  duration_unit        VARCHAR(32)     NULL,
  schedule_json        LONGTEXT        NULL,
  created_at           BIGINT          NOT NULL,
  updated_at           BIGINT          NOT NULL,
  PRIMARY KEY (id),
  KEY idx_records_user (user_id),
  KEY idx_records_status (status),
  KEY idx_records_direction (direction),
  KEY idx_records_local (user_id, local_id),
  CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  record_id  BIGINT UNSIGNED NOT NULL,
  local_id   BIGINT          NULL,
  amount     DECIMAL(18,2)   NOT NULL,
  pay_date   DATE            NOT NULL,
  method     ENUM('CASH','UPI','BANK_TRANSFER','OTHER') NOT NULL DEFAULT 'CASH',
  note       TEXT            NULL,
  created_at BIGINT          NOT NULL,
  PRIMARY KEY (id),
  KEY idx_payments_record (record_id),
  KEY idx_payments_user (user_id),
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_record FOREIGN KEY (record_id) REFERENCES money_records(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS calculation_history (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  local_id        BIGINT          NULL,
  type            VARCHAR(32)     NOT NULL,
  principal       DECIMAL(18,2)   NOT NULL,
  rate            DECIMAL(18,6)   NOT NULL,
  rate_period     ENUM('DAILY','MONTHLY','YEARLY') NULL,
  duration        VARCHAR(255)    NULL,
  start_date      DATE            NULL,
  end_date        DATE            NULL,
  result_interest DECIMAL(18,2)   NOT NULL,
  result_total    DECIMAL(18,2)   NOT NULL,
  metadata        JSON            NULL,
  record_id       BIGINT UNSIGNED NULL,
  created_at      BIGINT          NOT NULL,
  PRIMARY KEY (id),
  KEY idx_history_user (user_id),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_settings (
  user_id                 BIGINT UNSIGNED NOT NULL,
  currency                VARCHAR(8)      NOT NULL DEFAULT 'INR',
  theme                   ENUM('LIGHT','DARK','SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  biometric_enabled       TINYINT(1)      NOT NULL DEFAULT 0,
  pin_enabled             TINYINT(1)      NOT NULL DEFAULT 0,
  pin_hash                VARCHAR(255)    NULL,
  auto_lock_minutes       INT             NOT NULL DEFAULT 5,
  hide_sensitive_values   TINYINT(1)      NOT NULL DEFAULT 0,
  default_rate_period     ENUM('DAILY','MONTHLY','YEARLY') NOT NULL DEFAULT 'YEARLY',
  default_interest_type   VARCHAR(32)     NOT NULL DEFAULT 'SIMPLE',
  include_end_date        TINYINT(1)      NOT NULL DEFAULT 1,
  payment_allocation_rule ENUM('INTEREST_FIRST','PRINCIPAL_FIRST','PROPORTIONATE') NOT NULL DEFAULT 'INTEREST_FIRST',
  onboarding_completed    TINYINT(1)      NOT NULL DEFAULT 0,
  updated_at              BIGINT          NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
