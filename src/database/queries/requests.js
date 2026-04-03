const pool = require('../connection');

/**
 * Создать новый запрос
 */
async function createRequest(telegramId, photoFileId, nutritionData, weight = null) {
  const query = `
    INSERT INTO requests_history 
    (user_telegram_id, photo_file_id, dish_name, calories, protein, fat, carbs, weight)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [
    telegramId,
    photoFileId,
    nutritionData.dishName,
    nutritionData.calories,
    nutritionData.protein,
    nutritionData.fat,
    nutritionData.carbs,
    weight,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Обновить запрос (при корректировке)
 */
async function updateRequest(requestId, nutritionData) {
  const query = `
    UPDATE requests_history
    SET calories = $2,
        protein = $3,
        fat = $4,
        carbs = $5,
        is_corrected = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const values = [
    requestId,
    nutritionData.calories,
    nutritionData.protein,
    nutritionData.fat,
    nutritionData.carbs,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Получить количество запросов пользователя за сегодня
 */
async function getTodayRequestCount(telegramId) {
  const query = `
    SELECT COUNT(*) as count
    FROM requests_history
    WHERE user_telegram_id = $1
      AND created_at >= CURRENT_DATE
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
  `;
  const result = await pool.query(query, [telegramId]);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Получить запрос по ID
 */
async function getRequestById(requestId) {
  const query = 'SELECT * FROM requests_history WHERE id = $1';
  const result = await pool.query(query, [requestId]);
  return result.rows[0];
}

module.exports = {
  createRequest,
  updateRequest,
  getTodayRequestCount,
  getRequestById,
};
