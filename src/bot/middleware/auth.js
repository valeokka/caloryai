/**
 * Middleware для автоматической регистрации пользователей
 */

const userService = require('../../services/userService');
const logger = require('../../utils/logger');

/**
 * Auth middleware - автоматически регистрирует пользователей при первом обращении
 * и сохраняет объект пользователя в ctx.state для использования в обработчиках
 */
async function authMiddleware(ctx, next) {
  try {
    // Проверяем наличие информации о пользователе
    if (!ctx.from || !ctx.from.id) {
      logger.warn('Request without user information');
      return next();
    }

    const telegramId = ctx.from.id;

    // Получаем или создаем пользователя
    const user = await userService.getOrCreateUser(telegramId);

    // Сохраняем пользователя в ctx.state для использования в обработчиках
    ctx.state.user = user;

    logger.debug('User authenticated', {
      telegramId,
      userClassId: user.user_class_id,
      purchasedRequests: user.purchased_requests
    });

    return next();
  } catch (error) {
    logger.error('Error in auth middleware', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });

    // Продолжаем выполнение, даже если произошла ошибка
    // Обработчики должны сами решать, что делать без ctx.state.user
    return next();
  }
}

module.exports = authMiddleware;
