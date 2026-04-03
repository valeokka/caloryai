/**
 * Middleware для проверки лимитов запросов
 */

const requestService = require('../../services/requestService');
const logger = require('../../utils/logger');
const { MESSAGES } = require('../../config/constants');
const { showPaymentMethods } = require('../handlers/payment');

function rateLimitMiddleware() {
  return async (ctx, next) => {
    try {
      if (!ctx.message || !ctx.message.photo) {
        return next();
      }

      const telegramId = ctx.from.id;
      const { allowed, reason, usedPurchased } = await requestService.canMakeRequest(telegramId);

      if (!allowed) {
        logger.info('Request denied due to rate limit', { telegramId });
        await showPaymentMethods(ctx, reason || MESSAGES.LIMIT_REACHED);
        return;
      }

      ctx.state.usedPurchased = usedPurchased;
      return next();
    } catch (error) {
      logger.error('Error in rate limit middleware', {
        userId: ctx.from?.id,
        error: error.message,
        stack: error.stack
      });
      await ctx.reply(MESSAGES.ERROR);
      return;
    }
  };
}

module.exports = rateLimitMiddleware;
