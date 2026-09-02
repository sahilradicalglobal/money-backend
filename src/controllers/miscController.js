const { query } = require('../config/database');
const { nowMs, mapHistoryRow, mapSettingsRow, roundMoney } = require('../utils/helpers');

async function listHistory(req, res, next) {
  try {
    const rows = await query(
      'SELECT * FROM calculation_history WHERE user_id = :userId ORDER BY created_at DESC',
      { userId: req.user.id }
    );
    res.json({ success: true, data: rows.map(mapHistoryRow) });
  } catch (err) {
    next(err);
  }
}

async function createHistory(req, res, next) {
  try {
    const b = req.body;
    const ts = b.createdAt || nowMs();
    const result = await query(
      `INSERT INTO calculation_history (
        user_id, local_id, type, principal, rate, rate_period, duration,
        start_date, end_date, result_interest, result_total, metadata, record_id, created_at
      ) VALUES (
        :userId, :localId, :type, :principal, :rate, :ratePeriod, :duration,
        :startDate, :endDate, :resultInterest, :resultTotal, :metadata, :recordId, :createdAt
      )`,
      {
        userId: req.user.id,
        localId: b.localId ?? null,
        type: b.type,
        principal: b.principal,
        rate: b.rate,
        ratePeriod: b.ratePeriod ?? null,
        duration: b.duration ?? null,
        startDate: b.startDate ?? null,
        endDate: b.endDate ?? null,
        resultInterest: b.resultInterest,
        resultTotal: b.resultTotal,
        metadata: b.metadata ? JSON.stringify(b.metadata) : null,
        recordId: b.recordId ?? null,
        createdAt: ts,
      }
    );
    const rows = await query('SELECT * FROM calculation_history WHERE id = :id', { id: result.insertId });
    res.status(201).json({ success: true, data: mapHistoryRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function deleteHistory(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM calculation_history WHERE id = :id AND user_id = :userId',
      { id: req.params.id, userId: req.user.id }
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'History item not found' });
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const rows = await query('SELECT * FROM app_settings WHERE user_id = :userId', { userId: req.user.id });
    if (!rows.length) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: mapSettingsRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const b = req.body;
    const ts = nowMs();
    await query(
      `INSERT INTO app_settings (
        user_id, currency, theme, biometric_enabled, pin_enabled, pin_hash, auto_lock_minutes,
        hide_sensitive_values, default_rate_period, default_interest_type, include_end_date,
        payment_allocation_rule, onboarding_completed, updated_at
      ) VALUES (
        :userId, :currency, :theme, :biometricEnabled, :pinEnabled, :pinHash, :autoLockMinutes,
        :hideSensitiveValues, :defaultRatePeriod, :defaultInterestType, :includeEndDate,
        :paymentAllocationRule, :onboardingCompleted, :updatedAt
      ) ON DUPLICATE KEY UPDATE
        currency = VALUES(currency),
        theme = VALUES(theme),
        biometric_enabled = VALUES(biometric_enabled),
        pin_enabled = VALUES(pin_enabled),
        pin_hash = VALUES(pin_hash),
        auto_lock_minutes = VALUES(auto_lock_minutes),
        hide_sensitive_values = VALUES(hide_sensitive_values),
        default_rate_period = VALUES(default_rate_period),
        default_interest_type = VALUES(default_interest_type),
        include_end_date = VALUES(include_end_date),
        payment_allocation_rule = VALUES(payment_allocation_rule),
        onboarding_completed = VALUES(onboarding_completed),
        updated_at = VALUES(updated_at)`,
      {
        userId: req.user.id,
        currency: b.currency ?? 'INR',
        theme: b.theme ?? 'SYSTEM',
        biometricEnabled: b.biometricEnabled ? 1 : 0,
        pinEnabled: b.pinEnabled ? 1 : 0,
        pinHash: b.pinHash ?? null,
        autoLockMinutes: b.autoLockMinutes ?? 5,
        hideSensitiveValues: b.hideSensitiveValues ? 1 : 0,
        defaultRatePeriod: b.defaultRatePeriod ?? 'YEARLY',
        defaultInterestType: b.defaultInterestType ?? 'SIMPLE',
        includeEndDate: b.includeEndDate !== false ? 1 : 0,
        paymentAllocationRule: b.paymentAllocationRule ?? 'INTEREST_FIRST',
        onboardingCompleted: b.onboardingCompleted ? 1 : 0,
        updatedAt: ts,
      }
    );
    const rows = await query('SELECT * FROM app_settings WHERE user_id = :userId', { userId: req.user.id });
    res.json({ success: true, data: mapSettingsRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function dashboardSummary(req, res, next) {
  try {
    const rows = await query(
      `SELECT direction, total_amount, total_interest, paid_amount, remaining_amount, status
       FROM money_records WHERE user_id = :userId`,
      { userId: req.user.id }
    );

    let totalGiven = 0;
    let totalReceived = 0;
    let totalInterest = 0;
    let outstanding = 0;
    let activeRecords = 0;

    for (const r of rows) {
      totalInterest += Number(r.total_interest);
      outstanding += Number(r.remaining_amount);
      if (r.status === 'PENDING') activeRecords++;

      if (r.direction === 'GIVEN') {
        totalGiven += Number(r.total_amount);
        totalReceived += Number(r.paid_amount);
      } else if (r.direction === 'RECEIVED') {
        totalReceived += Number(r.paid_amount);
      }
    }

    res.json({
      success: true,
      data: {
        totalGiven: roundMoney(totalGiven),
        totalReceived: roundMoney(totalReceived),
        totalInterest: roundMoney(totalInterest),
        outstanding: roundMoney(outstanding),
        activeRecords,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listHistory,
  createHistory,
  deleteHistory,
  getSettings,
  updateSettings,
  dashboardSummary,
};
