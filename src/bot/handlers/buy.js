/**
 * Обработчик команды /buy - покупка запросов
 */

const { showPaymentMethods } = require('./payment');
const logger = require('../../utils/logger');

/**
 * Обработчик команды /buy
 */
async function buyHandler(ctx) {
  try {
    const userId = ctx.from.id;
    logger.info('Buy command received', { userId });

    // Показываем методы оплаты с приветственным сообщением
    await showPaymentMethods(
      ctx,
      '💳 Покупка дополнительных запросов\n\n' +
      'Выбери способ оплаты:'
    );
  } catch (error) {
    logger.error('Error in buyHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    
    await ctx.reply('⚠️ Произошла ошибка. Попробуй позже.');
  }
}

module.exports = buyHandler;
