const pool = require('../connection');
const logger = require('../../utils/logger');

/**
 * Получить пользователя по telegram_id
 */
async function getUser(telegramId) {
  const query = 'SELECT * FROM users WHERE telegram_id = $1';
  const result = await pool.query(query, [telegramId]);
  return result.rows[0];
}

/**
 * Создать нового пользователя
 */
async function createUser(telegramId) {
  const query = `
    INSERT INTO users (telegram_id, user_class_id, purchased_requests)
    VALUES ($1, 1, 0)
    RETURNING *
  `;
  const result = await pool.query(query, [telegramId]);
  return result.rows[0];
}

/**
 * Обновить количество купленных запросов (атомарная операция)
 */
async function updatePurchasedRequests(telegramId, amount) {
  const query = `
    UPDATE users 
    SET purchased_requests = purchased_requests + $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [telegramId, amount]);
  return result.rows[0];
}

/**
 * Атомарно уменьшить купленные запросы (только если они есть)
 * Возвращает обновленного пользователя если успешно, null если запросов не хватает
 * Решает проблему race condition при одновременных запросах
 */
async function decrementPurchasedRequestAtomic(telegramId) {
  const query = `
    UPDATE users 
    SET purchased_requests = purchased_requests - 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = $1 AND purchased_requests > 0
    RETURNING *
  `;
  const result = await pool.query(query, [telegramId]);
  
  if (result.rows.length === 0) {
    logger.warn(`Failed to decrement purchased request for user ${telegramId} - no requests available`);
    return null;
  }
  
  return result.rows[0];
}

/**
 * Получить пользователя с информацией о классе
 */
async function getUserWithClass(telegramId) {
  const query = `
    SELECT u.*, uc.class_name, uc.daily_limit
    FROM users u
    JOIN user_classes uc ON u.user_class_id = uc.id
    WHERE u.telegram_id = $1
  `;
  const result = await pool.query(query, [telegramId]);
  return result.rows[0];
}

module.exports = {
  getUser,
  createUser,
  updatePurchasedRequests,
  decrementPurchasedRequestAtomic,
  getUserWithClass,
};
