/**
 * Обработчик команды /start
 */

const { MESSAGES } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Обработчик команды /start
 * @param {Object} ctx - Контекст Telegraf
 */
async function startHandler(ctx) {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'пользователь';

    logger.info(`User ${userId} (${username}) started the bot`);

    // Отправляем приветственное сообщение
    await ctx.reply(MESSAGES.WELCOME, { parse_mode: 'HTML' });

  } catch (error) {
    logger.error('Error in startHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    await ctx.reply(MESSAGES.ERROR);
  }
}

module.exports = startHandler;
