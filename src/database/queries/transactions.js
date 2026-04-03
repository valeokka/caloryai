const pool = require('../connection');

/**
 * Создать транзакцию
 */
async function createTransaction(telegramId, amount, currency, requestsPurchased, paymentProvider, paymentId) {
  const query = `
    INSERT INTO transactions 
    (user_telegram_id, amount, currency, requests_purchased, payment_provider, payment_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'completed')
    RETURNING *
  `;
  const values = [telegramId, amount, currency, requestsPurchased, paymentProvider, paymentId];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Получить транзакции пользователя
 */
async function getUserTransactions(telegramId) {
  const query = `
    SELECT * FROM transactions
    WHERE user_telegram_id = $1
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [telegramId]);
  return result.rows;
}

module.exports = {
  createTransaction,
  getUserTransactions,
};
