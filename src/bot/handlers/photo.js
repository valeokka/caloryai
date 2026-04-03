/**
 * Обработчик фотографий
 */

const { Markup } = require('telegraf');
const requestService = require('../../services/requestService');
const openaiService = require('../../services/openai');
const { formatNutritionData } = require('../../utils/formatter');
const { MESSAGES, PAYMENT_PACKAGES } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Обработчик фотографий
 * @param {Object} ctx - Контекст Telegraf
 */
async function photoHandler(ctx) {
  try {
    const userId = ctx.from.id;
    const photos = ctx.message.photo;
    const caption = ctx.message.caption || '';

    logger.info(`User ${userId} sent a photo`, { caption });

    // Проверяем возможность запроса через RequestService.canMakeRequest
    const requestCheck = await requestService.canMakeRequest(userId);

    if (!requestCheck.allowed) {
      // При достижении лимита показываем кнопки для покупки запросов
      const buttons = PAYMENT_PACKAGES.map((pkg, index) => 
        Markup.button.callback(
          `${pkg.requests} запросов - ${pkg.price} ${pkg.currency}`,
          `buy_${index}`
        )
      );

      await ctx.reply(
        requestCheck.reason,
        Markup.inlineKeyboard(buttons, { columns: 1 })
      );
      return;
    }

    // Если используем купленный запрос, уменьшаем счетчик
    if (requestCheck.usedPurchased) {
      await requestService.decrementPurchasedRequest(userId);
      logger.info(`User ${userId} used a purchased request`);
    }

    // Отправляем сообщение о начале обработки
    await ctx.reply(MESSAGES.PROCESSING);

    // Извлекаем file_id самой большой версии фото
    const largestPhoto = photos[photos.length - 1];
    const fileId = largestPhoto.file_id;

    // Получаем URL фотографии через Telegram API
    const file = await ctx.telegram.getFile(fileId);
    const photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Парсим подпись на наличие веса порции (regex)
    let weight = null;
    const weightMatch = caption.match(/\d+/);
    if (weightMatch) {
      weight = parseInt(weightMatch[0], 10);
      logger.info(`Weight detected: ${weight}g`);
    }

    // Отправляем фото в OpenAIService.analyzeFood
    const nutritionData = await openaiService.analyzeFood(photoUrl, weight);
    logger.info('Nutrition data received', nutritionData);

    // Сохраняем результат через RequestService.saveRequest
    const savedRequest = await requestService.saveRequest(
      userId,
      fileId,
      nutritionData,
      weight
    );

    // Форматируем и отправляем ответ с inline-кнопкой "Корректировать результаты"
    const message = formatNutritionData({
      ...nutritionData,
      weight
    });

    await ctx.reply(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✏️ Корректировать результаты', `correct_${savedRequest.id}`)
        ])
      }
    );

    logger.info(`Successfully processed photo for user ${userId}`, {
      requestId: savedRequest.id
    });

  } catch (error) {
    logger.error('Error in photoHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });

    // Отправляем понятное сообщение пользователю
    if (error.message.includes('API') || error.message.includes('timeout')) {
      await ctx.reply(MESSAGES.API_ERROR);
    } else if (error.message.includes('database') || error.message.includes('DB')) {
      await ctx.reply(MESSAGES.DB_ERROR);
    } else {
      await ctx.reply(MESSAGES.ERROR);
    }
  }
}

module.exports = photoHandler;
