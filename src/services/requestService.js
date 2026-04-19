/**
 * Сервис для работы с запросами на анализ
 */

const requestQueries = require('../database/queries/requests');
const userQueries = require('../database/queries/users');
const userService = require('./userService');
const logger = require('../utils/logger');

class RequestService {
  /**
   * Проверить лимиты пользователя (общая логика)
   * @private
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} { allowed: boolean, reason: string, usedPurchased: boolean, user: Object }
   */
  async _checkLimits(telegramId) {
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
        usedPurchased: false,
        user
      };
    }

    // Если в пределах дневного лимита
    if (todayCount < userClass.daily_limit) {
      return { 
        allowed: true,
        usedPurchased: false,
        user
      };
    }

    // Если есть купленные запросы
    if (user.purchased_requests > 0) {
      return { 
        allowed: true,
        usedPurchased: true,
        user
      };
    }

    // Лимит исчерпан
    return { 
      allowed: false,
      reason: 'Дневной лимит исчерпан. Купите дополнительные запросы.',
      usedPurchased: false,
      user
    };
  }

  /**
   * Атомарно проверить и списать запрос (решает проблему race condition)
   * 
   * ВАЖНО: Race condition решена на уровне БД через атомарный UPDATE с условием:
   * UPDATE users SET purchased_requests = purchased_requests - 1 
   * WHERE telegram_id = $1 AND purchased_requests > 0
   * 
   * Это гарантирует, что даже при одновременных запросах от одного пользователя
   * запрос будет списан только если он есть в наличии.
   * 
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} { allowed: boolean, reason: string, usedPurchased: boolean }
   */
  async consumeRequestAtomic(telegramId) {
    try {
      const checkResult = await this._checkLimits(telegramId);

      if (!checkResult.allowed) {
        return {
          allowed: false,
          reason: checkResult.reason,
          usedPurchased: false
        };
      }

      // Если нужно списать купленный запрос
      if (checkResult.usedPurchased) {
        const updatedUser = await userQueries.decrementPurchasedRequestAtomic(telegramId);
        
        if (updatedUser) {
          logger.info(`User ${telegramId} used a purchased request atomically`);
          return { 
            allowed: true,
            usedPurchased: true
          };
        }

        // Race condition: запросы закончились между проверкой и списанием
        return { 
          allowed: false,
          reason: 'Дневной лимит исчерпан. Купите дополнительные запросы.',
          usedPurchased: false
        };
      }

      // Используем бесплатный лимит
      return { 
        allowed: true,
        usedPurchased: false
      };
    } catch (error) {
      logger.error('Error in consumeRequestAtomic', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Проверить, может ли пользователь сделать запрос (без списания)
   * @param {number} telegramId - Telegram ID пользователя
   * @returns {Promise<Object>} { allowed: boolean, reason: string, usedPurchased: boolean }
   */
  async canMakeRequest(telegramId) {
    try {
      const checkResult = await this._checkLimits(telegramId);
      
      return {
        allowed: checkResult.allowed,
        reason: checkResult.reason,
        usedPurchased: checkResult.usedPurchased
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
}

module.exports = new RequestService();
