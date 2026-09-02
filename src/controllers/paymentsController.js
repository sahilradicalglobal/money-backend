const { query, getConnection } = require('../config/database');
const { nowMs, mapPaymentRow, mapRecordRow, roundMoney } = require('../utils/helpers');

async function listPayments(req, res, next) {
  try {
    const recordId = req.params.recordId;
    const owned = await query(
      'SELECT id FROM money_records WHERE id = :recordId AND user_id = :userId',
      { recordId, userId: req.user.id }
    );
    if (!owned.length) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const rows = await query(
      'SELECT * FROM payments WHERE record_id = :recordId AND user_id = :userId ORDER BY pay_date DESC, created_at DESC',
      { recordId, userId: req.user.id }
    );
    res.json({ success: true, data: rows.map(mapPaymentRow) });
  } catch (err) {
    next(err);
  }
}

async function addPayment(req, res, next) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const recordId = req.params.recordId;
    const [records] = await conn.execute(
      'SELECT * FROM money_records WHERE id = :recordId AND user_id = :userId FOR UPDATE',
      { recordId, userId: req.user.id }
    );
    if (!records.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const record = records[0];
    const b = req.body;
    const ts = b.createdAt || nowMs();

    const [insertResult] = await conn.execute(
      `INSERT INTO payments (user_id, record_id, local_id, amount, pay_date, method, note, created_at)
       VALUES (:userId, :recordId, :localId, :amount, :payDate, :method, :note, :createdAt)`,
      {
        userId: req.user.id,
        recordId,
        localId: b.localId ?? null,
        amount: b.amount,
        payDate: b.date,
        method: b.method || 'CASH',
        note: b.note ?? null,
        createdAt: ts,
      }
    );

    const totalPaid = roundMoney(Number(record.paid_amount) + Number(b.amount));
    const remaining = roundMoney(Math.max(Number(record.total_amount) - totalPaid, 0));
    const status = remaining <= 0.005 ? 'COMPLETED' : 'PENDING';

    await conn.execute(
      `UPDATE money_records SET paid_amount = :paid, remaining_amount = :remaining, status = :status, updated_at = :updatedAt
       WHERE id = :recordId`,
      { paid: totalPaid, remaining, status, updatedAt: ts, recordId }
    );

    await conn.commit();

    const [paymentRows] = await conn.execute('SELECT * FROM payments WHERE id = :id', { id: insertResult.insertId });
    const [recordRows] = await conn.execute('SELECT * FROM money_records WHERE id = :id', { id: recordId });

    res.status(201).json({
      success: true,
      data: {
        payment: mapPaymentRow(paymentRows[0]),
        record: mapRecordRow(recordRows[0]),
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function deletePayment(req, res, next) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { recordId, paymentId } = req.params;
    const [payments] = await conn.execute(
      'SELECT * FROM payments WHERE id = :paymentId AND record_id = :recordId AND user_id = :userId',
      { paymentId, recordId, userId: req.user.id }
    );
    if (!payments.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const payment = payments[0];
    const [records] = await conn.execute(
      'SELECT * FROM money_records WHERE id = :recordId FOR UPDATE',
      { recordId }
    );
    const record = records[0];

    await conn.execute('DELETE FROM payments WHERE id = :paymentId', { paymentId });

    const totalPaid = roundMoney(Math.max(Number(record.paid_amount) - Number(payment.amount), 0));
    const remaining = roundMoney(Math.max(Number(record.total_amount) - totalPaid, 0));
    const status = remaining <= 0.005 ? 'COMPLETED' : 'PENDING';
    const ts = nowMs();

    await conn.execute(
      `UPDATE money_records SET paid_amount = :paid, remaining_amount = :remaining, status = :status, updated_at = :updatedAt
       WHERE id = :recordId`,
      { paid: totalPaid, remaining, status, updatedAt: ts, recordId }
    );

    await conn.commit();
    res.json({ success: true, message: 'Payment deleted' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = { listPayments, addPayment, deletePayment };
