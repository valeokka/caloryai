/**
 * Сервис для работы с профилями пользователей
 */

const profileQueries = require('../database/queries/profiles');
const calorieCalculator = require('./calorieCalculator');
const logger = require('../utils/logger');

class ProfileService {
  /**
   * Получить профиль пользователя
   */
  async getProfile(telegramId) {
    try {
      return await profileQueries.getProfile(telegramId);
    } catch (error) {
      logger.error('Error getting profile', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Создать или обновить профиль с расчетом калорий и нутриентов
   */
  async createOrUpdateProfile(telegramId, { gender, age, weight, height, activityLevel }) {
    try {
      // Рассчитываем BMR и TDEE
      const { bmr, dailyCalories } = calorieCalculator.calculate({
        gender,
        weight,
        height,
        age,
        activityLevel
      });

      // По умолчанию: поддержание веса (0%)
      const nutritionCalculator = require('./nutritionCalculator');
      const nutrition = nutritionCalculator.calculateSimpleMode({
        tdee: dailyCalories,
        bmr,
        gender,
        weight,
        percent: 0
      });

      // Сохраняем профиль
      const profile = await profileQueries.upsertProfile(telegramId, {
        gender,
        age,
        weight,
        height,
        activityLevel,
        calorieGoal: nutrition.target_calories,
        isManualGoal: false,
        goalType: nutrition.goal_type,
        goalMode: nutrition.goal_mode,
        goalPercent: nutrition.goal_percent,
        tdee: nutrition.tdee,
        targetCalories: nutrition.target_calories,
        proteinPerKg: nutrition.protein_per_kg,
        fatPerKg: nutrition.fat_per_kg,
        proteinG: nutrition.protein_g,
        fatG: nutrition.fat_g,
        carbsG: nutrition.carbs_g
      });

      logger.info('Profile created/updated', { 
        telegramId, 
        bmr, 
        tdee: dailyCalories,
        targetCalories: nutrition.target_calories
      });

      return { profile, bmr, dailyCalories, nutrition };
    } catch (error) {
      logger.error('Error creating/updating profile', { 
        telegramId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Обновить цель калорий вручную
   */
  async updateCalorieGoalManually(telegramId, calorieGoal) {
    try {
      if (calorieGoal <= 0 || calorieGoal > 10000) {
        throw new Error('Цель калорий должна быть от 1 до 10000');
      }

      const profile = await profileQueries.updateCalorieGoal(telegramId, calorieGoal, true);
      
      if (!profile) {
        throw new Error('Профиль не найден. Сначала заполните профиль.');
      }

      logger.info('Calorie goal updated manually', { telegramId, calorieGoal });

      return profile;
    } catch (error) {
      logger.error('Error updating calorie goal', { 
        telegramId, 
        calorieGoal,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Пересчитать цель калорий на основе текущих данных профиля
   */
  async recalculateCalorieGoal(telegramId) {
    try {
      const profile = await profileQueries.getProfile(telegramId);
      
      if (!profile) {
        throw new Error('Профиль не найден. Сначала заполните профиль.');
      }

      // Пересчитываем калории
      const { bmr, dailyCalories } = calorieCalculator.calculate({
        gender: profile.gender,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        activityLevel: profile.activity_level
      });

      // Обновляем цель
      const updatedProfile = await profileQueries.updateCalorieGoal(
        telegramId, 
        dailyCalories, 
        false
      );

      logger.info('Calorie goal recalculated', { 
        telegramId, 
        bmr, 
        dailyCalories 
      });

      return { profile: updatedProfile, bmr, dailyCalories };
    } catch (error) {
      logger.error('Error recalculating calorie goal', { 
        telegramId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Удалить профиль
   */
  async deleteProfile(telegramId) {
    try {
      const profile = await profileQueries.deleteProfile(telegramId);
      
      logger.info('Profile deleted', { telegramId });
      
      return profile;
    } catch (error) {
      logger.error('Error deleting profile', { 
        telegramId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Установить цель (упрощенный режим)
   */
  async setGoalSimple(telegramId, percent) {
    try {
      const profile = await profileQueries.getProfile(telegramId);
      
      if (!profile) {
        throw new Error('Профиль не найден. Сначала заполните профиль.');
      }

      const nutritionCalculator = require('./nutritionCalculator');
      const { bmr } = calorieCalculator.calculate({
        gender: profile.gender,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        activityLevel: parseFloat(profile.activity_level)
      });

      const nutrition = nutritionCalculator.calculateSimpleMode({
        tdee: profile.tdee || profile.calorie_goal,
        bmr,
        gender: profile.gender,
        weight: profile.weight,
        percent
      });

      const updatedProfile = await profileQueries.updateGoalAndNutrition(telegramId, {
        goalType: nutrition.goal_type,
        goalMode: nutrition.goal_mode,
        goalPercent: nutrition.goal_percent,
        tdee: nutrition.tdee,
        targetCalories: nutrition.target_calories,
        proteinPerKg: nutrition.protein_per_kg,
        fatPerKg: nutrition.fat_per_kg,
        proteinG: nutrition.protein_g,
        fatG: nutrition.fat_g,
        carbsG: nutrition.carbs_g
      });

      logger.info('Goal set (simple mode)', { telegramId, percent, nutrition });

      return { profile: updatedProfile, nutrition };
    } catch (error) {
      logger.error('Error setting goal (simple)', { 
        telegramId, 
        percent,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Установить цель (расширенный режим)
   */
  async setGoalAdvanced(telegramId, { calories, percent, proteinPerKg, fatPerKg }) {
    try {
      const profile = await profileQueries.getProfile(telegramId);
      
      if (!profile) {
        throw new Error('Профиль не найден. Сначала заполните профиль.');
      }

      const nutritionCalculator = require('./nutritionCalculator');
      const { bmr } = calorieCalculator.calculate({
        gender: profile.gender,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        activityLevel: parseFloat(profile.activity_level)
      });

      const nutrition = nutritionCalculator.calculateAdvancedMode({
        tdee: profile.tdee || profile.calorie_goal,
        bmr,
        gender: profile.gender,
        weight: profile.weight,
        calories,
        percent,
        proteinPerKg,
        fatPerKg
      });

      const updatedProfile = await profileQueries.updateGoalAndNutrition(telegramId, {
        goalType: nutrition.goal_type,
        goalMode: nutrition.goal_mode,
        goalPercent: nutrition.goal_percent,
        tdee: nutrition.tdee,
        targetCalories: nutrition.target_calories,
        proteinPerKg: nutrition.protein_per_kg,
        fatPerKg: nutrition.fat_per_kg,
        proteinG: nutrition.protein_g,
        fatG: nutrition.fat_g,
        carbsG: nutrition.carbs_g
      });

      logger.info('Goal set (advanced mode)', { telegramId, nutrition });

      return { profile: updatedProfile, nutrition };
    } catch (error) {
      logger.error('Error setting goal (advanced)', { 
        telegramId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new ProfileService();
