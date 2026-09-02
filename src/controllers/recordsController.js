const { query } = require('../config/database');
const { nowMs, mapRecordRow, roundMoney } = require('../utils/helpers');

async function listRecords(req, res, next) {
  try {
    const { direction, status, search } = req.query;
    let sql = 'SELECT * FROM money_records WHERE user_id = :userId';
    const params = { userId: req.user.id };

    if (direction) {
      sql += ' AND direction = :direction';
      params.direction = direction;
    }
    if (status) {
      sql += ' AND status = :status';
      params.status = status;
    }
    if (search) {
      sql += ' AND (name LIKE :search OR notes LIKE :search)';
      params.search = `%${search}%`;
    }
    sql += ' ORDER BY updated_at DESC';

    const rows = await query(sql, params);
    res.json({ success: true, data: rows.map(mapRecordRow) });
  } catch (err) {
    next(err);
  }
}

async function getRecord(req, res, next) {
  try {
    const rows = await query(
      'SELECT * FROM money_records WHERE id = :id AND user_id = :userId',
      { id: req.params.id, userId: req.user.id }
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, data: mapRecordRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createRecord(req, res, next) {
  try {
    const b = req.body;
    const ts = b.createdAt || nowMs();
    const result = await query(
      `INSERT INTO money_records (
        user_id, local_id, name, direction, principal, interest_type, rate, rate_period,
        start_date, due_date, total_interest, total_amount, paid_amount, remaining_amount,
        status, notes, duration_description, duration_value, duration_unit, schedule_json,
        created_at, updated_at
      ) VALUES (
        :userId, :localId, :name, :direction, :principal, :interestType, :rate, :ratePeriod,
        :startDate, :dueDate, :totalInterest, :totalAmount, :paidAmount, :remainingAmount,
        :status, :notes, :durationDescription, :durationValue, :durationUnit, :scheduleJson,
        :createdAt, :updatedAt
      )`,
      {
        userId: req.user.id,
        localId: b.localId ?? null,
        name: b.name ?? null,
        direction: b.direction,
        principal: b.principal,
        interestType: b.interestType,
        rate: b.rate,
        ratePeriod: b.ratePeriod ?? null,
        startDate: b.startDate ?? null,
        dueDate: b.dueDate ?? null,
        totalInterest: b.totalInterest ?? 0,
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount ?? 0,
        remainingAmount: b.remainingAmount ?? b.totalAmount,
        status: b.status ?? 'PENDING',
        notes: b.notes ?? null,
        durationDescription: b.durationDescription ?? null,
        durationValue: b.durationValue ?? null,
        durationUnit: b.durationUnit ?? null,
        scheduleJson: b.scheduleJson ?? null,
        createdAt: ts,
        updatedAt: b.updatedAt || ts,
      }
    );

    const rows = await query('SELECT * FROM money_records WHERE id = :id', { id: result.insertId });
    res.status(201).json({ success: true, data: mapRecordRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateRecord(req, res, next) {
  try {
    const existing = await query(
      'SELECT id FROM money_records WHERE id = :id AND user_id = :userId',
      { id: req.params.id, userId: req.user.id }
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const b = req.body;
    const ts = b.updatedAt || nowMs();
    await query(
      `UPDATE money_records SET
        local_id = COALESCE(:localId, local_id),
        name = COALESCE(:name, name),
        direction = COALESCE(:direction, direction),
        principal = COALESCE(:principal, principal),
        interest_type = COALESCE(:interestType, interest_type),
        rate = COALESCE(:rate, rate),
        rate_period = COALESCE(:ratePeriod, rate_period),
        start_date = COALESCE(:startDate, start_date),
        due_date = COALESCE(:dueDate, due_date),
        total_interest = COALESCE(:totalInterest, total_interest),
        total_amount = COALESCE(:totalAmount, total_amount),
        paid_amount = COALESCE(:paidAmount, paid_amount),
        remaining_amount = COALESCE(:remainingAmount, remaining_amount),
        status = COALESCE(:status, status),
        notes = COALESCE(:notes, notes),
        duration_description = COALESCE(:durationDescription, duration_description),
        duration_value = COALESCE(:durationValue, duration_value),
        duration_unit = COALESCE(:durationUnit, duration_unit),
        schedule_json = COALESCE(:scheduleJson, schedule_json),
        updated_at = :updatedAt
      WHERE id = :id AND user_id = :userId`,
      {
        id: req.params.id,
        userId: req.user.id,
        localId: b.localId ?? null,
        name: b.name ?? null,
        direction: b.direction ?? null,
        principal: b.principal ?? null,
        interestType: b.interestType ?? null,
        rate: b.rate ?? null,
        ratePeriod: b.ratePeriod ?? null,
        startDate: b.startDate ?? null,
        dueDate: b.dueDate ?? null,
        totalInterest: b.totalInterest ?? null,
        totalAmount: b.totalAmount ?? null,
        paidAmount: b.paidAmount ?? null,
        remainingAmount: b.remainingAmount ?? null,
        status: b.status ?? null,
        notes: b.notes ?? null,
        durationDescription: b.durationDescription ?? null,
        durationValue: b.durationValue ?? null,
        durationUnit: b.durationUnit ?? null,
        scheduleJson: b.scheduleJson ?? null,
        updatedAt: ts,
      }
    );

    const rows = await query('SELECT * FROM money_records WHERE id = :id', { id: req.params.id });
    res.json({ success: true, data: mapRecordRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function deleteRecord(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM money_records WHERE id = :id AND user_id = :userId',
      { id: req.params.id, userId: req.user.id }
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
};
