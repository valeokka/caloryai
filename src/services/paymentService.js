/**
 * Сервис для работы с платежами
 */

const { PAYMENT_PACKAGES } = require('../config/constants');
const userService = require('./userService');
const transactionQueries = require('../database/queries/transactions');
const logger = require('../utils/logger');

class PaymentService {
  /**
   * Создать инвойс для оплаты
   * @param {number} packageIndex - Индекс пакета из PAYMENT_PACKAGES
   * @returns {Object} Данные для создания инвойса
   */
  createInvoice(packageIndex) {
    try {
      if (packageIndex < 0 || packageIndex >= PAYMENT_PACKAGES.length) {
        throw new Error('Invalid package index');
      }

      const package_ = PAYMENT_PACKAGES[packageIndex];
      
      logger.info(`Creating invoice for package: ${package_.title}`);

      return {
        title: package_.title,
        description: package_.description,
        payload: JSON.stringify({
          packageIndex,
          requests: package_.requests
        }),
        currency: package_.currency,
        prices: [{
          label: package_.title,
          amount: package_.price * 100 // Telegram требует цену в копейках
        }]
      };
    } catch (error) {
      logger.error('Error in createInvoice', { packageIndex, error: error.message });
      throw error;
    }
  }

  /**
   * Обработать успешный платеж
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} payload - Payload из инвойса
   * @returns {Promise<Object>} Обновленный пользователь
   */
  async processPayment(telegramId, payload) {
    try {
      const payloadData = JSON.parse(payload);
      const { requests } = payloadData;

      logger.info(`Processing payment for user ${telegramId}: ${requests} requests`);

      // Обновить purchased_requests через UserService
      const updatedUser = await userService.updatePurchasedRequests(telegramId, requests);

      return updatedUser;
    } catch (error) {
      logger.error('Error in processPayment', { 
        telegramId, 
        payload, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Сохранить транзакцию в базу данных
   * @param {number} telegramId - Telegram ID пользователя
   * @param {number} amount - Сумма платежа
   * @param {string} currency - Валюта
   * @param {number} requestsPurchased - Количество купленных запросов
   * @param {string} paymentProvider - Провайдер платежа
   * @param {string} paymentId - ID платежа
   * @returns {Promise<Object>} Созданная транзакция
   */
  async saveTransaction(telegramId, amount, currency, requestsPurchased, paymentProvider, paymentId) {
    try {
      logger.info(`Saving transaction for user ${telegramId}`, {
        amount,
        currency,
        requestsPurchased,
        paymentProvider,
        paymentId
      });

      const transaction = await transactionQueries.createTransaction(
        telegramId,
        amount,
        currency,
        requestsPurchased,
        paymentProvider,
        paymentId
      );

      return transaction;
    } catch (error) {
      logger.error('Error in saveTransaction', { 
        telegramId, 
        amount, 
        currency, 
        requestsPurchased,
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new PaymentService();
