/**
 * Сервис для работы с запросами на анализ
 */

const requestQueries = require('../database/queries/requests');
const userQueries = require('../database/queries/users');
const userService = require('./userService');
const logger = require('../utils/logger');

class RequestService {
  /**
   * Проверить, может ли пользователь сделать запрос
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} { allowed: boolean, reason: string, usedPurchased: boolean }
   */
  async canMakeRequest(telegramId) {
    try {
      const user = await userService.getOrCreateUser(telegramId);
      const userClass = await userService.getUserClass(user.user_class_id);
      const todayCount = await requestQueries.getTodayRequestCount(telegramId);

      logger.info('Checking request limits', {
        telegramId,
        className: userClass.class_name,
        dailyLimit: userClass.daily_limit,
        todayCount,
        purchasedRequests: user.purchased_requests
      });

      // Если безлимит (PREMIUM/ADMIN)
      if (userClass.daily_limit === null) {
        return { 
          allowed: true,
          usedPurchased: false
        };
      }

      // Если в пределах дневного лимита
      if (todayCount < userClass.daily_limit) {
        return { 
          allowed: true,
          usedPurchased: false
        };
      }

      // Если есть купленные запросы
      if (user.purchased_requests > 0) {
        return { 
          allowed: true,
          usedPurchased: true
        };
      }

      // Лимит исчерпан
      return { 
        allowed: false,
        reason: 'Дневной лимит исчерпан. Купите дополнительные запросы.',
        usedPurchased: false
      };
    } catch (error) {
      logger.error('Error in canMakeRequest', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Сохранить запрос в базу данных
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} photoFileId - File ID фотографии
   * @param {Object} nutritionData - Данные о пищевой ценности
   * @param {number|null} weight - Вес порции в граммах
   * @returns {Promise<Object>} Созданный запрос
   */
  async saveRequest(telegramId, photoFileId, nutritionData, weight = null) {
    try {
      logger.info('Saving request', { telegramId, photoFileId, weight });
      const request = await requestQueries.createRequest(
        telegramId,
        photoFileId,
        nutritionData,
        weight
      );
      return request;
    } catch (error) {
      logger.error('Error in saveRequest', { 
        telegramId, 
        photoFileId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Обновить запрос (при корректировке)
   * @param {number} requestId - ID запроса
   * @param {Object} nutritionData - Обновленные данные о пищевой ценности
   * @returns {Promise<Object>} Обновленный запрос
   */
  async updateRequest(requestId, nutritionData) {
    try {
      logger.info('Updating request', { requestId, nutritionData });
      const request = await requestQueries.updateRequest(requestId, nutritionData);
      return request;
    } catch (error) {
      logger.error('Error in updateRequest', { requestId, error: error.message });
      throw error;
    }
  }

  /**
   * Получить количество запросов за сегодня
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<number>} Количество запросов
   */
  async getTodayRequestCount(telegramId) {
    try {
      const count = await requestQueries.getTodayRequestCount(telegramId);
      return count;
    } catch (error) {
      logger.error('Error in getTodayRequestCount', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Уменьшить счетчик купленных запросов
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} Обновленный пользователь
   */
  async decrementPurchasedRequest(telegramId) {
    try {
      logger.info('Decrementing purchased request', { telegramId });
      const user = await userQueries.updatePurchasedRequests(telegramId, -1);
      return user;
    } catch (error) {
      logger.error('Error in decrementPurchasedRequest', { 
        telegramId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new RequestService();
