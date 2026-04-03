/**
 * Обработчик команды /status
 */

const userService = require('../../services/userService');
const { formatUserStats } = require('../../utils/formatter');
const { MESSAGES } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Обработчик команды /status
 * @param {Object} ctx - Контекст Telegraf
 */
async function statusHandler(ctx) {
  try {
    const userId = ctx.from.id;

    logger.info(`User ${userId} requested status`);

    // Получаем статистику пользователя через UserService
    const stats = await userService.getUserStats(userId);

    // Форматируем и отправляем сообщение
    const message = formatUserStats(stats);
    await ctx.reply(message, { parse_mode: 'HTML' });

  } catch (error) {
    logger.error('Error in statusHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    await ctx.reply(MESSAGES.ERROR);
  }
}

module.exports = statusHandler;
