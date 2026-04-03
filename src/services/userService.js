/**
 * Сервис для работы с пользователями
 */

const userQueries = require('../database/queries/users');
const classQueries = require('../database/queries/classes');
const requestQueries = require('../database/queries/requests');
const logger = require('../utils/logger');

class UserService {
  /**
   * Получить или создать пользователя
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} Объект пользователя
   */
  async getOrCreateUser(telegramId) {
    try {
      let user = await userQueries.getUser(telegramId);
      
      if (!user) {
        logger.info(`Creating new user with telegram_id: ${telegramId}`);
        user = await userQueries.createUser(telegramId);
      }
      
      return user;
    } catch (error) {
      logger.error('Error in getOrCreateUser', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Получить класс пользователя
   * @param {number} userClassId - ID класса пользователя
   * @returns {Promise<Object>} Объект класса пользователя
   */
  async getUserClass(userClassId) {
    try {
      const userClass = await classQueries.getClassById(userClassId);
      return userClass;
    } catch (error) {
      logger.error('Error in getUserClass', { userClassId, error: error.message });
      throw error;
    }
  }

  /**
   * Обновить количество купленных запросов
   * @param {number} telegramId - Telegram ID пользователя
   * @param {number} amount - Количество запросов для добавления
   * @returns {Promise<Object>} Обновленный объект пользователя
   */
  async updatePurchasedRequests(telegramId, amount) {
    try {
      logger.info(`Updating purchased requests for user ${telegramId}: +${amount}`);
      const user = await userQueries.updatePurchasedRequests(telegramId, amount);
      return user;
    } catch (error) {
      logger.error('Error in updatePurchasedRequests', { 
        telegramId, 
        amount, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Получить статистику пользователя
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} Статистика пользователя
   */
  async getUserStats(telegramId) {
    try {
      const userWithClass = await userQueries.getUserWithClass(telegramId);
      
      if (!userWithClass) {
        throw new Error('User not found');
      }

      const todayRequestCount = await requestQueries.getTodayRequestCount(telegramId);
      
      // Рассчитываем оставшиеся запросы
      let remainingRequests = null;
      if (userWithClass.daily_limit !== null) {
        remainingRequests = Math.max(0, userWithClass.daily_limit - todayRequestCount);
      }

      return {
        className: userWithClass.class_name,
        dailyLimit: userWithClass.daily_limit,
        usedToday: todayRequestCount,
        remainingToday: remainingRequests,
        purchasedRequests: userWithClass.purchased_requests,
        isUnlimited: userWithClass.daily_limit === null
      };
    } catch (error) {
      logger.error('Error in getUserStats', { telegramId, error: error.message });
      throw error;
    }
  }
}

module.exports = new UserService();
