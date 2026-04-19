/**
 * Обработчик фотографий
 */

const { Markup } = require('telegraf');
const requestService = require('../../services/requestService');
const openaiService = require('../../services/openai');
const { formatNutritionData } = require('../../utils/formatter');
const { extractWeightFromText } = require('../../utils/validator');
const { MESSAGES, VALIDATION, CACHE } = require('../../config/constants');
const { showPaymentMethods } = require('./payment');
const logger = require('../../utils/logger');
const requestQueries = require('../../database/queries/requests');

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

    // Извлекаем file_id самой большой версии фото
    const largestPhoto = photos[photos.length - 1];
    const fileId = largestPhoto.file_id;
    const fileSize = largestPhoto.file_size;

    // Проверяем размер фото
    if (fileSize && fileSize > VALIDATION.PHOTO.MAX_SIZE_BYTES) {
      const maxSizeMB = VALIDATION.PHOTO.MAX_SIZE_MB;
      const actualSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      logger.warn(`Photo too large: ${actualSizeMB}MB (max: ${maxSizeMB}MB)`, { userId, fileId });
      
      await ctx.reply(
        MESSAGES.PHOTO_TOO_LARGE.replace('{maxSize}', maxSizeMB) + 
        `\n\nРазмер твоего фото: ${actualSizeMB}МБ`
      );
      return;
    }

    // Проверяем кэш, если включен
    if (CACHE.ENABLED) {
      const cachedResult = await requestQueries.getCachedResult(fileId, CACHE.TTL_HOURS);
      
      if (cachedResult) {
        logger.info(`Cache hit for file_id: ${fileId}`, { userId, cachedRequestId: cachedResult.id });
        
        await ctx.reply(
          MESSAGES.CACHED_RESULT + '\n\n' + formatNutritionData({
            dishName: cachedResult.dish_name,
            calories: parseFloat(cachedResult.calories),
            protein: parseFloat(cachedResult.protein),
            fat: parseFloat(cachedResult.fat),
            carbs: parseFloat(cachedResult.carbs),
            weight: cachedResult.weight
          }),
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✏️ Корректировать результаты', `correct_${cachedResult.id}`)
            ])
          }
        );
        
        return;
      }
    }

    // Отправляем сообщение о начале обработки
    await ctx.reply(MESSAGES.PROCESSING);

    // Извлекаем вес из подписи используя validator
    const weight = extractWeightFromText(caption);
    if (weight) {
      logger.info(`Weight detected: ${weight}g`);
    }

    // Атомарная проверка и списание запроса
    const requestResult = await requestService.consumeRequestAtomic(userId);
    
    if (!requestResult.allowed) {
      await showPaymentMethods(ctx, requestResult.reason);
      return;
    }

    logger.info(`User ${userId} request approved`, { 
      usedPurchased: requestResult.usedPurchased 
    });

    // Получаем URL фотографии через Telegram API
    const photoUrl = await ctx.telegram.getFileLink(fileId);
    
    // ВАЖНО: Отправляем URL напрямую, БЕЗ base64!
    // Base64 изображения занимают в 30-40 раз больше токенов
    // OpenAI сам скачает и оптимизирует изображение
    const imageToSend = photoUrl.href;

    // Отправляем фото в OpenAI для анализа
    const nutritionData = await openaiService.analyzeFood(imageToSend, weight);
    logger.info('Nutrition data received', { 
      ...nutritionData,
      cost: nutritionData.cost ? `$${nutritionData.cost.toFixed(4)}` : undefined,
      tokens: nutritionData.tokens
    });

    // Сохраняем результат (используем вес из OpenAI, если не был указан пользователем)
    const finalWeight = weight || nutritionData.weight;
    const savedRequest = await requestService.saveRequest(
      userId,
      fileId,
      nutritionData,
      finalWeight
    );

    // Отправляем результат пользователю (используем вес из nutritionData)
    await ctx.reply(
      formatNutritionData(nutritionData),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✏️ Корректировать результаты', `correct_${savedRequest.id}`)
        ])
      }
    );

    logger.info(`Successfully processed photo for user ${userId}`, {
      requestId: savedRequest.id,
      cached: false
    });

  } catch (error) {
    logger.error('Error in photoHandler', {
      userId: ctx.from?.id,
      error: error.message,
      errorType: error.type || 'unknown',
      stack: error.stack
    });

    // Отправляем сообщение в зависимости от типа ошибки
    if (error.type) {
      await ctx.reply(error.message);
    } else if (error.message.includes('database') || error.message.includes('DB')) {
      await ctx.reply(MESSAGES.DB_ERROR);
    } else {
      await ctx.reply(MESSAGES.ERROR);
    }
  }
}

module.exports = photoHandler;
