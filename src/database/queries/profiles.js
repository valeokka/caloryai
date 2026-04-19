const pool = require('../connection');
const logger = require('../../utils/logger');

/**
 * Получить профиль пользователя
 */
async function getProfile(telegramId) {
  const query = 'SELECT * FROM user_profiles WHERE telegram_id = $1';
  const result = await pool.query(query, [telegramId]);
  return result.rows[0];
}

/**
 * Создать или обновить профиль пользователя
 */
async function upsertProfile(telegramId, profileData) {
  const { 
    gender, age, weight, height, activityLevel, calorieGoal, isManualGoal,
    goalType, goalMode, goalPercent, tdee, targetCalories,
    proteinPerKg, fatPerKg, proteinG, fatG, carbsG
  } = profileData;
  
  const query = `
    INSERT INTO user_profiles (
      telegram_id, gender, age, weight, height, 
      activity_level, calorie_goal, is_manual_goal,
      goal_type, goal_mode, goal_percent, tdee, target_calories,
      protein_per_kg, fat_per_kg, protein_g, fat_g, carbs_g,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
    ON CONFLICT (telegram_id) 
    DO UPDATE SET
      gender = EXCLUDED.gender,
      age = EXCLUDED.age,
      weight = EXCLUDED.weight,
      height = EXCLUDED.height,
      activity_level = EXCLUDED.activity_level,
      calorie_goal = EXCLUDED.calorie_goal,
      is_manual_goal = EXCLUDED.is_manual_goal,
      goal_type = EXCLUDED.goal_type,
      goal_mode = EXCLUDED.goal_mode,
      goal_percent = EXCLUDED.goal_percent,
      tdee = EXCLUDED.tdee,
      target_calories = EXCLUDED.target_calories,
      protein_per_kg = EXCLUDED.protein_per_kg,
      fat_per_kg = EXCLUDED.fat_per_kg,
      protein_g = EXCLUDED.protein_g,
      fat_g = EXCLUDED.fat_g,
      carbs_g = EXCLUDED.carbs_g,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    telegramId, gender, age, weight, height, 
    activityLevel, calorieGoal, isManualGoal,
    goalType, goalMode, goalPercent, tdee, targetCalories,
    proteinPerKg, fatPerKg, proteinG, fatG, carbsG
  ]);
  
  return result.rows[0];
}

/**
 * Обновить только цель калорий
 */
async function updateCalorieGoal(telegramId, calorieGoal, isManual = true) {
  const query = `
    UPDATE user_profiles 
    SET calorie_goal = $2,
        is_manual_goal = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = $1
    RETURNING *
  `;
  
  const result = await pool.query(query, [telegramId, calorieGoal, isManual]);
  return result.rows[0];
}

/**
 * Удалить профиль пользователя
 */
async function deleteProfile(telegramId) {
  const query = 'DELETE FROM user_profiles WHERE telegram_id = $1 RETURNING *';
  const result = await pool.query(query, [telegramId]);
  return result.rows[0];
}

module.exports = {
  getProfile,
  upsertProfile,
  updateCalorieGoal,
  deleteProfile,
};


/**
 * Обновить цель и нутриенты
 */
async function updateGoalAndNutrition(telegramId, nutritionData) {
  const {
    goalType, goalMode, goalPercent, tdee, targetCalories,
    proteinPerKg, fatPerKg, proteinG, fatG, carbsG
  } = nutritionData;
  
  const isManualGoal = goalMode === 'advanced';
  
  const query = `
    UPDATE user_profiles 
    SET goal_type = $2,
        goal_mode = $3,
        goal_percent = $4,
        tdee = $5,
        target_calories = $6,
        protein_per_kg = $7,
        fat_per_kg = $8,
        protein_g = $9,
        fat_g = $10,
        carbs_g = $11,
        calorie_goal = $6,
        is_manual_goal = $12,
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = $1
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    telegramId, goalType, goalMode, goalPercent, tdee, targetCalories,
    proteinPerKg, fatPerKg, proteinG, fatG, carbsG, isManualGoal
  ]);
  
  return result.rows[0];
}

module.exports = {
  getProfile,
  upsertProfile,
  updateCalorieGoal,
  updateGoalAndNutrition,
  deleteProfile,
};
