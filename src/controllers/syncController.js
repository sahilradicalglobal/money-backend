const { getConnection } = require('../config/database');
const { nowMs, mapRecordRow, mapPaymentRow, mapHistoryRow, mapSettingsRow } = require('../utils/helpers');

/** Export all user data — compatible with Android app backup shape. */
async function exportBackup(req, res, next) {
  try {
    const userId = req.user.id;
    const conn = await getConnection();

    try {
      const [records] = await conn.execute('SELECT * FROM money_records WHERE user_id = ? ORDER BY id', [userId]);
      const [payments] = await conn.execute('SELECT * FROM payments WHERE user_id = ? ORDER BY id', [userId]);
      const [history] = await conn.execute('SELECT * FROM calculation_history WHERE user_id = ? ORDER BY id', [userId]);
      const [settingsRows] = await conn.execute('SELECT * FROM app_settings WHERE user_id = ?', [userId]);

      res.json({
        success: true,
        data: {
          backup_version: 1,
          exported_at: nowMs(),
          records: records.map(mapRecordRow),
          payments: payments.map(mapPaymentRow),
          history: history.map(mapHistoryRow),
          settings: settingsRows.length ? mapSettingsRow(settingsRows[0]) : null,
        },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

/** Import backup — stores pre-calculated values as-is (no server-side interest calculation). */
async function importBackup(req, res, next) {
  const conn = await getConnection();
  try {
    const body = req.body;
    if (body.backup_version !== 1) {
      return res.status(400).json({ success: false, message: 'Unsupported backup version' });
    }

    await conn.beginTransaction();
    const userId = req.user.id;

    await conn.execute('DELETE FROM money_records WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM calculation_history WHERE user_id = ?', [userId]);

    const records = body.records || [];
    const recordIdMap = new Map();

    for (const r of records) {
      const ts = r.createdAt || nowMs();
      const [result] = await conn.execute(
        `INSERT INTO money_records (
          user_id, local_id, name, direction, principal, interest_type, rate, rate_period,
          start_date, due_date, total_interest, total_amount, paid_amount, remaining_amount,
          status, notes, duration_description, duration_value, duration_unit, schedule_json,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId, r.localId ?? r.id ?? null, r.name ?? null, r.direction, r.principal,
          r.interestType, r.rate, r.ratePeriod ?? null, r.startDate ?? null, r.dueDate ?? null,
          r.totalInterest ?? 0, r.totalAmount, r.paidAmount ?? 0, r.remainingAmount ?? r.totalAmount,
          r.status ?? 'PENDING', r.notes ?? null, r.durationDescription ?? null,
          r.durationValue ?? null, r.durationUnit ?? null, r.scheduleJson ?? null, ts, r.updatedAt || ts,
        ]
      );
      if (r.id) recordIdMap.set(r.id, result.insertId);
      if (r.localId) recordIdMap.set(r.localId, result.insertId);
    }

    for (const p of body.payments || []) {
      const mappedRecordId = recordIdMap.get(p.recordId) || p.recordId;
      await conn.execute(
        `INSERT INTO payments (user_id, record_id, local_id, amount, pay_date, method, note, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          userId, mappedRecordId, p.localId ?? p.id ?? null, p.amount, p.date,
          p.method || 'CASH', p.note ?? null, p.createdAt || nowMs(),
        ]
      );
    }

    for (const h of body.history || []) {
      const mappedRecordId = h.recordId ? (recordIdMap.get(h.recordId) || h.recordId) : null;
      await conn.execute(
        `INSERT INTO calculation_history (
          user_id, local_id, type, principal, rate, rate_period, duration,
          start_date, end_date, result_interest, result_total, metadata, record_id, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId, h.localId ?? h.id ?? null, h.type, h.principal, h.rate, h.ratePeriod ?? null,
          h.duration ?? null, h.startDate ?? null, h.endDate ?? null, h.resultInterest, h.resultTotal,
          h.metadata ? JSON.stringify(h.metadata) : null, mappedRecordId, h.createdAt || nowMs(),
        ]
      );
    }

    if (body.settings) {
      const s = body.settings;
      const ts = nowMs();
      await conn.execute(
        `INSERT INTO app_settings (
          user_id, currency, theme, biometric_enabled, pin_enabled, pin_hash, auto_lock_minutes,
          hide_sensitive_values, default_rate_period, default_interest_type, include_end_date,
          payment_allocation_rule, onboarding_completed, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          currency=VALUES(currency), theme=VALUES(theme), biometric_enabled=VALUES(biometric_enabled),
          pin_enabled=VALUES(pin_enabled), pin_hash=VALUES(pin_hash),
          auto_lock_minutes=VALUES(auto_lock_minutes), hide_sensitive_values=VALUES(hide_sensitive_values),
          default_rate_period=VALUES(default_rate_period), default_interest_type=VALUES(default_interest_type),
          include_end_date=VALUES(include_end_date), payment_allocation_rule=VALUES(payment_allocation_rule),
          onboarding_completed=VALUES(onboarding_completed), updated_at=VALUES(updated_at)`,
        [
          userId, s.currency ?? 'INR', s.theme ?? 'SYSTEM', s.biometricEnabled ? 1 : 0,
          s.pinEnabled ? 1 : 0, s.pinHash ?? null, s.autoLockMinutes ?? 5,
          s.hideSensitiveValues ? 1 : 0, s.defaultRatePeriod ?? 'YEARLY',
          s.defaultInterestType ?? 'SIMPLE', s.includeEndDate !== false ? 1 : 0,
          s.paymentAllocationRule ?? 'INTEREST_FIRST', s.onboardingCompleted ? 1 : 0, ts,
        ]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Backup imported successfully', imported: { records: records.length } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = { exportBackup, importBackup };
