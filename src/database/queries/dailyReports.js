const pool = require('../connection');
const logger = require('../../utils/logger');

/**
 * Получить или создать дневной отчет
 */
async function getOrCreateDailyReport(telegramId, date = new Date()) {
  const reportDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Пытаемся получить существующий отчет
  let query = `
    SELECT * FROM daily_reports 
    WHERE user_telegram_id = $1 AND report_date = $2
  `;
  let result = await pool.query(query, [telegramId, reportDate]);
  
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  
  // Создаем новый отчет с целями из профиля
  const profileQuery = `
    SELECT target_calories, protein_g, fat_g, carbs_g 
    FROM user_profiles 
    WHERE telegram_id = $1
  `;
  const profileResult = await pool.query(profileQuery, [telegramId]);
  
  const profile = profileResult.rows[0];
  const targetCalories = profile?.target_calories || 2000;
  const targetProtein = profile?.protein_g || 100;
  const targetFat = profile?.fat_g || 70;
  const targetCarbs = profile?.carbs_g || 250;
  
  query = `
    INSERT INTO daily_reports (
      user_telegram_id, report_date, 
      target_calories, target_protein, target_fat, target_carbs
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  result = await pool.query(query, [
    telegramId, reportDate, 
    targetCalories, targetProtein, targetFat, targetCarbs
  ]);
  
  return result.rows[0];
}

/**
 * Получить дневной отчет с приемами пищи
 */
async function getDailyReportWithMeals(telegramId, date = new Date()) {
  const reportDate = date.toISOString().split('T')[0];
  
  // Получаем отчет
  const report = await getOrCreateDailyReport(telegramId, date);
  
  // Получаем приемы пищи за день
  const mealsQuery = `
    SELECT * FROM requests_history
    WHERE user_telegram_id = $1 
      AND DATE(meal_time) = $2
      AND is_deleted = false
    ORDER BY meal_time ASC
  `;
  
  const mealsResult = await pool.query(mealsQuery, [telegramId, reportDate]);
  
  return {
    report,
    meals: mealsResult.rows
  };
}

/**
 * Обновить потребленные значения в отчете
 */
async function updateConsumedValues(telegramId, date = new Date()) {
  const reportDate = date.toISOString().split('T')[0];
  
  // Суммируем все приемы пищи за день
  const query = `
    UPDATE daily_reports
    SET consumed_calories = COALESCE((
          SELECT SUM(calories) 
          FROM requests_history 
          WHERE user_telegram_id = $1 
            AND DATE(meal_time) = $2
            AND is_deleted = false
        ), 0),
        consumed_protein = COALESCE((
          SELECT SUM(protein) 
          FROM requests_history 
          WHERE user_telegram_id = $1 
            AND DATE(meal_time) = $2
            AND is_deleted = false
        ), 0),
        consumed_fat = COALESCE((
          SELECT SUM(fat) 
          FROM requests_history 
          WHERE user_telegram_id = $1 
            AND DATE(meal_time) = $2
            AND is_deleted = false
        ), 0),
        consumed_carbs = COALESCE((
          SELECT SUM(carbs) 
          FROM requests_history 
          WHERE user_telegram_id = $1 
            AND DATE(meal_time) = $2
            AND is_deleted = false
        ), 0),
        meals_count = COALESCE((
          SELECT COUNT(*) 
          FROM requests_history 
          WHERE user_telegram_id = $1 
            AND DATE(meal_time) = $2
            AND is_deleted = false
        ), 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_telegram_id = $1 AND report_date = $2
    RETURNING *
  `;
  
  const result = await pool.query(query, [telegramId, reportDate]);
  return result.rows[0];
}

/**
 * Пометить прием пищи как удаленный
 */
async function deleteMeal(mealId, telegramId) {
  const query = `
    UPDATE requests_history
    SET is_deleted = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_telegram_id = $2
    RETURNING *
  `;
  
  const result = await pool.query(query, [mealId, telegramId]);
  
  if (result.rows.length > 0) {
    // Обновляем дневной отчет
    const meal = result.rows[0];
    const mealDate = new Date(meal.meal_time);
    await updateConsumedValues(telegramId, mealDate);
  }
  
  return result.rows[0];
}

/**
 * Получить отчеты за период
 */
async function getReportsForPeriod(telegramId, startDate, endDate) {
  const query = `
    SELECT * FROM daily_reports
    WHERE user_telegram_id = $1
      AND report_date >= $2
      AND report_date <= $3
    ORDER BY report_date DESC
  `;
  
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  
  const result = await pool.query(query, [telegramId, start, end]);
  return result.rows;
}

module.exports = {
  getOrCreateDailyReport,
  getDailyReportWithMeals,
  updateConsumedValues,
  deleteMeal,
  getReportsForPeriod
};
