function nowMs() {
  return Date.now();
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function pick(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

function mapRecordRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    localId: row.local_id,
    name: row.name,
    direction: row.direction,
    principal: roundMoney(row.principal),
    interestType: row.interest_type,
    rate: Number(row.rate),
    ratePeriod: row.rate_period,
    startDate: row.start_date ? row.start_date.toISOString().slice(0, 10) : null,
    dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
    totalInterest: roundMoney(row.total_interest),
    totalAmount: roundMoney(row.total_amount),
    paidAmount: roundMoney(row.paid_amount),
    remainingAmount: roundMoney(row.remaining_amount),
    status: row.status,
    notes: row.notes,
    durationDescription: row.duration_description,
    durationValue: row.duration_value,
    durationUnit: row.duration_unit,
    scheduleJson: row.schedule_json,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapPaymentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    localId: row.local_id,
    recordId: row.record_id,
    amount: roundMoney(row.amount),
    date: row.pay_date ? row.pay_date.toISOString().slice(0, 10) : null,
    method: row.method,
    note: row.note,
    createdAt: Number(row.created_at),
  };
}

function mapHistoryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    localId: row.local_id,
    type: row.type,
    principal: roundMoney(row.principal),
    rate: Number(row.rate),
    ratePeriod: row.rate_period,
    duration: row.duration,
    startDate: row.start_date ? row.start_date.toISOString().slice(0, 10) : null,
    endDate: row.end_date ? row.end_date.toISOString().slice(0, 10) : null,
    resultInterest: roundMoney(row.result_interest),
    resultTotal: roundMoney(row.result_total),
    metadata: row.metadata,
    recordId: row.record_id,
    createdAt: Number(row.created_at),
  };
}

function mapSettingsRow(row) {
  if (!row) return null;
  return {
    currency: row.currency,
    theme: row.theme,
    biometricEnabled: Boolean(row.biometric_enabled),
    pinEnabled: Boolean(row.pin_enabled),
    pinHash: row.pin_hash,
    autoLockMinutes: row.auto_lock_minutes,
    hideSensitiveValues: Boolean(row.hide_sensitive_values),
    defaultRatePeriod: row.default_rate_period,
    defaultInterestType: row.default_interest_type,
    includeEndDate: Boolean(row.include_end_date),
    paymentAllocationRule: row.payment_allocation_rule,
    onboardingCompleted: Boolean(row.onboarding_completed),
    updatedAt: Number(row.updated_at),
  };
}

module.exports = {
  nowMs,
  roundMoney,
  pick,
  mapRecordRow,
  mapPaymentRow,
  mapHistoryRow,
  mapSettingsRow,
};
