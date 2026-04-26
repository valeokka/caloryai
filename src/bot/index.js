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
const buyHandler = require('./handlers/buy');
const photoHandler = require('./handlers/photo');
const { 
  correctionHandler, 
  handleCorrectionInput, 
  isCorrectionMessage 
} = require('./handlers/correction');
const {
  handleMethodSelection,
  handleStarsPackageSelection,
  handlePayBack,
  handlePreCheckout,
  handleSuccessfulPayment
} = require('./handlers/payment');
const {
  profileHandler,
  profileCallbackHandler,
  handleProfileInput,
  handleGenderSelection,
  handleActivitySelection,
  isProfileMessage
} = require('./handlers/profile');
const {
  showTodayDiary,
  diaryCallbackHandler
} = require('./handlers/diary');
const {
  showGoalModeSelection,
  showSimpleModeGoals,
  handleSimpleGoalSelection,
  showAdvancedMode,
  startAdvancedCaloriesInput,
  startAdvancedMacrosInput,
  applyAdvancedDefaults,
  handleAdvancedDefaults,
  handleAdvancedInput,
  isGoalMessage
} = require('./handlers/goals');
const {
  isFoodText,
  handleTextFood
} = require('./handlers/textFood');
const {
  testCommand,
  testCallbackHandler,
  handleTestInput,
  handleTestPhoto,
  isTestMessage
} = require('./handlers/modelTest');

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
  bot.command('buy', buyHandler);
  bot.command('profile', profileHandler);
  bot.command('diary', showTodayDiary);
  bot.command('test', testCommand);

  // Регистрируем обработчик фотографий
  bot.on('photo', async (ctx) => {
    // Сначала проверяем, это фото для тестирования
    if (isTestMessage(ctx)) {
      await handleTestPhoto(ctx);
    } else {
      // Обычная обработка фото
      await photoHandler(ctx);
    }
  });

  // Регистрируем обработчики callback_query
  bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    logger.info('Callback query received', { callbackData, userId: ctx.from?.id });
    
    try {
      if (callbackData.startsWith('correct_') || 
          callbackData.startsWith('edit_') || 
          callbackData.startsWith('cancel_')) {
        await correctionHandler(ctx);
      } else if (callbackData.startsWith('pay_method_')) {
        await handleMethodSelection(ctx);
      } else if (callbackData.startsWith('pay_stars_')) {
        await handleStarsPackageSelection(ctx);
      } else if (callbackData === 'pay_back') {
        await handlePayBack(ctx);
      } else if (callbackData.startsWith('profile_')) {
        // Обработка профиля
        if (callbackData.startsWith('profile_gender_')) {
          await handleGenderSelection(ctx);
        } else if (callbackData.startsWith('profile_activity_')) {
          await handleActivitySelection(ctx);
        } else if (callbackData === 'profile_back') {
          await profileHandler(ctx);
        } else {
          await profileCallbackHandler(ctx);
        }
      } else if (callbackData.startsWith('goal_')) {
        // Обработка целей
        if (callbackData === 'goal_mode_select') {
          await showGoalModeSelection(ctx);
        } else if (callbackData === 'goal_mode_simple') {
          await showSimpleModeGoals(ctx);
        } else if (callbackData === 'goal_mode_advanced') {
          await showAdvancedMode(ctx);
        } else if (callbackData.startsWith('goal_simple_')) {
          await handleSimpleGoalSelection(ctx);
        } else if (callbackData === 'goal_adv_calories') {
          await startAdvancedCaloriesInput(ctx);
        } else if (callbackData === 'goal_adv_macros') {
          await startAdvancedMacrosInput(ctx);
        } else if (callbackData === 'goal_adv_defaults') {
          await applyAdvancedDefaults(ctx);
        } else if (callbackData.startsWith('goal_adv_def_')) {
          await handleAdvancedDefaults(ctx);
        } else if (callbackData === 'goal_back') {
          await profileHandler(ctx);
        }
      } else if (callbackData.startsWith('diary_')) {
        // Обработка дневника
        await diaryCallbackHandler(ctx);
      } else if (callbackData.startsWith('test_') || callbackData === 'test_back') {
        // Обработка тестирования моделей
        await testCallbackHandler(ctx);
      } else if (callbackData.startsWith('buy_')) {
        // legacy кнопки — просто закрываем без сообщения
        await ctx.answerCbQuery();
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

  // Обработчик текстовых сообщений (для корректировки, профиля, целей и добавления еды)
  bot.on('text', async (ctx) => {
    try {
      // Проверяем, является ли это сообщением тестирования
      if (isTestMessage(ctx)) {
        await handleTestInput(ctx);
      } else if (isGoalMessage(ctx)) {
        // Проверяем, является ли это сообщением целей
        await handleAdvancedInput(ctx);
      } else if (isProfileMessage(ctx)) {
        // Проверяем, является ли это сообщением профиля
        await handleProfileInput(ctx);
      } else if (isCorrectionMessage(ctx)) {
        // Проверяем, является ли это сообщением корректировки
        await handleCorrectionInput(ctx);
      } else if (isFoodText(ctx.message.text)) {
        // Проверяем, является ли это описанием еды (например: "Куриная грудка 200г")
        await handleTextFood(ctx);
      } else {
        // Обычное текстовое сообщение - показываем справку
        await ctx.reply(
          '❓ Я понимаю только фотографии еды и команды.\n\n' +
          'Отправь мне фото блюда, и я подсчитаю калории!\n\n' +
          'Или напиши название еды и вес, например:\n' +
          '• Куриная грудка 200г\n' +
          '• Рис 150\n' +
          '• Яблоко 100 грамм\n\n' +
          'Доступные команды:\n' +
          '/start - показать приветствие\n' +
          '/status - проверить статус и лимиты\n' +
          '/buy - купить дополнительные запросы\n' +
          '/profile - управление профилем\n' +
          '/diary - дневник питания\n' +
          '/test - тестирование моделей'
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