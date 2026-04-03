/**
 * Главный модуль бота - инициализация и запуск
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');

// Middleware
const authMiddleware = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimit');

// Handlers
const startHandler = require('./handlers/start');
const statusHandler = require('./handlers/status');
const photoHandler = require('./handlers/photo');
const { 
  correctionHandler, 
  handleCorrectionInput, 
  isCorrectionMessage 
} = require('./handlers/correction');
const {
  handlePackageSelection,
  handlePreCheckout,
  handleSuccessfulPayment
} = require('./handlers/payment');

// Константы
const { MESSAGES } = require('../config/constants');

/**
 * Централизованный обработчик ошибок
 */
class ErrorHandler {
  static async handle(error, ctx) {
    logger.error('Unhandled bot error', {
      error: error.message,
      stack: error.stack,
      userId: ctx?.from?.id,
      updateType: ctx?.updateType,
      chatId: ctx?.chat?.id
    });

    try {
      // Пытаемся отправить сообщение об ошибке пользователю
      if (ctx && ctx.reply) {
        await ctx.reply(MESSAGES.ERROR);
      }
    } catch (replyError) {
      logger.error('Failed to send error message to user', {
        originalError: error.message,
        replyError: replyError.message,
        userId: ctx?.from?.id
      });
    }
  }
}

/**
 * Инициализация и настройка бота
 */
function initializeBot() {
  // Проверяем наличие обязательных переменных окружения
  if (!process.env.BOT_TOKEN) {
    logger.error('BOT_TOKEN is required');
    process.exit(1);
  }

  // Создаем экземпляр бота
  const bot = new Telegraf(process.env.BOT_TOKEN);

  // Регистрируем middleware
  logger.info('Registering middleware...');
  
  // Auth middleware - должен быть первым для всех запросов
  bot.use(authMiddleware);
  
  // Rate limit middleware - только для фотографий
  bot.use(rateLimitMiddleware());

  // Регистрируем обработчики команд
  logger.info('Registering command handlers...');
  
  bot.command('start', startHandler);
  bot.command('status', statusHandler);

  // Регистрируем обработчик фотографий
  bot.on('photo', photoHandler);

  // Регистрируем обработчики callback_query
  bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    
    try {
      if (callbackData.startsWith('correct_') || 
          callbackData.startsWith('edit_') || 
          callbackData.startsWith('cancel_')) {
        // Обработка корректировки результатов
        await correctionHandler(ctx);
      } else if (callbackData.startsWith('buy_')) {
        // Обработка выбора пакета для покупки
        await handlePackageSelection(ctx);
      } else {
        // Неизвестный callback
        logger.warn('Unknown callback query', { 
          callbackData, 
          userId: ctx.from.id 
        });
        await ctx.answerCbQuery('Неизвестная команда');
      }
    } catch (error) {
      logger.error('Error in callback_query handler', {
        callbackData,
        userId: ctx.from?.id,
        error: error.message,
        stack: error.stack
      });
      
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply(MESSAGES.ERROR);
    }
  });

  // Регистрируем обработчики платежей
  bot.on('pre_checkout_query', handlePreCheckout);
  bot.on('successful_payment', handleSuccessfulPayment);

  // Обработчик текстовых сообщений (для корректировки)
  bot.on('text', async (ctx) => {
    try {
      // Проверяем, является ли это сообщением корректировки
      if (isCorrectionMessage(ctx)) {
        await handleCorrectionInput(ctx);
      } else {
        // Обычное текстовое сообщение - показываем справку
        await ctx.reply(
          '❓ Я понимаю только фотографии еды и команды.\n\n' +
          'Отправь мне фото блюда, и я подсчитаю калории!\n\n' +
          'Доступные команды:\n' +
          '/start - показать приветствие\n' +
          '/status - проверить статус и лимиты'
        );
      }
    } catch (error) {
      logger.error('Error in text handler', {
        userId: ctx.from?.id,
        error: error.message,
        stack: error.stack
      });
      
      await ctx.reply(MESSAGES.ERROR);
    }
  });

  // Регистрируем централизованный обработчик ошибок
  bot.catch(ErrorHandler.handle);

  return bot;
}

/**
 * Запуск бота
 */
async function startBot() {
  try {
    logger.info('Starting Calorie Counter Bot...');
    
    const bot = initializeBot();
    
    // Запускаем бота
    await bot.launch();
    
    logger.info('Bot started successfully');
    
    // Graceful shutdown
    process.once('SIGINT', () => {
      logger.info('Received SIGINT, stopping bot...');
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM, stopping bot...');
      bot.stop('SIGTERM');
    });
    
  } catch (error) {
    logger.error('Failed to start bot', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Запускаем бота, если файл выполняется напрямую
if (require.main === module) {
  startBot();
}

module.exports = { initializeBot, startBot };