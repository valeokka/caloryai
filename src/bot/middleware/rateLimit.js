/**
 * Middleware для проверки лимитов запросов
 */

const requestService = require('../../services/requestService');
const logger = require('../../utils/logger');
const { MESSAGES, PAYMENT_PACKAGES } = require('../../config/constants');
const { Markup } = require('telegraf');

/**
 * Rate limit middleware - проверяет лимиты перед обработкой фото
 * Применяется только к обработчику фотографий
 */
function rateLimitMiddleware() {
  return async (ctx, next) => {
    try {
      // Проверяем, что это запрос с фотографией
      if (!ctx.message || !ctx.message.photo) {
        return next();
      }

      const telegramId = ctx.from.id;

      // Проверяем возможность сделать запрос
      const { allowed, reason, usedPurchased } = await requestService.canMakeRequest(telegramId);

      if (!allowed) {
        logger.info('Request denied due to rate limit', { telegramId });

        // Формируем кнопки для покупки запросов
        const buttons = PAYMENT_PACKAGES.map(pkg => 
          Markup.button.callback(
            `${pkg.title} - ${pkg.price} ${pkg.currency}`,
            `buy_${pkg.requests}`
          )
        );

        await ctx.reply(
          reason || MESSAGES.LIMIT_REACHED,
          Markup.inlineKeyboard(buttons, { columns: 1 })
        );

        // Прерываем обработку
        return;
      }

      // Сохраняем информацию о том, использовался ли купленный запрос
      ctx.state.usedPurchased = usedPurchased;

      logger.debug('Rate limit check passed', { 
        telegramId, 
        usedPurchased 
      });

      return next();
    } catch (error) {
      logger.error('Error in rate limit middleware', {
        userId: ctx.from?.id,
        error: error.message,
        stack: error.stack
      });

      await ctx.reply(MESSAGES.ERROR);
      
      // Прерываем обработку при ошибке
      return;
    }
  };
}

module.exports = rateLimitMiddleware;
