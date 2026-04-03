/**
 * Обработчик корректировки результатов
 */

const { Markup } = require('telegraf');
const requestService = require('../../services/requestService');
const { validateNutritionValue } = require('../../utils/validator');
const { formatNutritionData } = require('../../utils/formatter');
const { MESSAGES } = require('../../config/constants');
const logger = require('../../utils/logger');

// Хранилище состояний пользователей для корректировки
const correctionStates = new Map();

/**
 * Обработчик callback_query для кнопки "Корректировать результаты"
 * @param {Object} ctx - Контекст Telegraf
 */
async function correctionHandler(ctx) {
  try {
    const callbackData = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    logger.info(`Correction callback received`, { userId, callbackData });

    // Парсим callback_data
    if (callbackData.startsWith('correct_')) {
      // Начальная корректировка - показываем меню параметров
      const requestId = parseInt(callbackData.replace('correct_', ''), 10);
      await showCorrectionMenu(ctx, requestId);
    } else if (callbackData.startsWith('edit_')) {
      // Выбор параметра для редактирования
      const [action, parameter, requestId] = callbackData.split('_');
      await startParameterEdit(ctx, parameter, parseInt(requestId, 10));
    } else if (callbackData.startsWith('cancel_')) {
      // Отмена корректировки
      const requestId = parseInt(callbackData.replace('cancel_', ''), 10);
      await cancelCorrection(ctx, requestId);
    }

    // Подтверждаем callback
    await ctx.answerCbQuery();

  } catch (error) {
    logger.error('Error in correctionHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });

    await ctx.answerCbQuery('Произошла ошибка');
    await ctx.reply(MESSAGES.ERROR);
  }
}

/**
 * Показать inline-клавиатуру с параметрами для корректировки
 * @param {Object} ctx - Контекст Telegraf
 * @param {number} requestId - ID запроса
 */
async function showCorrectionMenu(ctx, requestId) {
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🔥 Калории', `edit_calories_${requestId}`),
      Markup.button.callback('🥩 Белки', `edit_protein_${requestId}`)
    ],
    [
      Markup.button.callback('🧈 Жиры', `edit_fat_${requestId}`),
      Markup.button.callback('🍞 Углеводы', `edit_carbs_${requestId}`)
    ],
    [
      Markup.button.callback('❌ Отмена', `cancel_${requestId}`)
    ]
  ]);

  await ctx.editMessageReplyMarkup(keyboard.reply_markup);
}

/**
 * Начать редактирование параметра
 * @param {Object} ctx - Контекст Telegraf
 * @param {string} parameter - Параметр для редактирования
 * @param {number} requestId - ID запроса
 */
async function startParameterEdit(ctx, parameter, requestId) {
  const userId = ctx.from.id;

  // Сохраняем состояние корректировки
  correctionStates.set(userId, {
    requestId,
    parameter,
    messageId: ctx.callbackQuery.message.message_id
  });

  // Получаем название параметра для отображения
  const parameterNames = {
    calories: 'Калории',
    protein: 'Белки',
    fat: 'Жиры',
    carbs: 'Углеводы'
  };

  const parameterName = parameterNames[parameter];

  // Отправляем запрос на ввод нового значения
  await ctx.reply(
    `✏️ Редактирование: <b>${parameterName}</b>\n\n${MESSAGES.CORRECTION_PROMPT}`,
    { parse_mode: 'HTML' }
  );

  logger.info('Started parameter edit', { userId, parameter, requestId });
}

/**
 * Отменить корректировку
 * @param {Object} ctx - Контекст Telegraf
 * @param {number} requestId - ID запроса
 */
async function cancelCorrection(ctx, requestId) {
  const userId = ctx.from.id;

  // Удаляем состояние корректировки
  correctionStates.delete(userId);

  // Возвращаем исходную кнопку корректировки
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('✏️ Корректировать результаты', `correct_${requestId}`)
  ]);

  await ctx.editMessageReplyMarkup(keyboard.reply_markup);

  logger.info('Correction cancelled', { userId, requestId });
}

/**
 * Обработчик текстовых сообщений для корректировки
 * @param {Object} ctx - Контекст Telegraf
 */
async function handleCorrectionInput(ctx) {
  try {
    const userId = ctx.from.id;
    const inputValue = ctx.message.text;

    // Проверяем, есть ли активная корректировка для пользователя
    const correctionState = correctionStates.get(userId);
    if (!correctionState) {
      return; // Не наша корректировка
    }

    const { requestId, parameter, messageId } = correctionState;

    logger.info('Processing correction input', { 
      userId, 
      requestId, 
      parameter, 
      inputValue 
    });

    // Получаем название параметра для валидации
    const parameterNames = {
      calories: 'Калории',
      protein: 'Белки',
      fat: 'Жиры',
      carbs: 'Углеводы'
    };

    const parameterName = parameterNames[parameter];

    // Валидируем введенное значение
    const validation = validateNutritionValue(inputValue, parameterName);

    if (!validation.valid) {
      await ctx.reply(validation.error);
      return;
    }

    // Получаем текущие данные запроса
    const requestQueries = require('../../database/queries/requests');
    const currentRequest = await requestQueries.getRequestById(requestId);

    if (!currentRequest) {
      await ctx.reply('Запрос не найден');
      correctionStates.delete(userId);
      return;
    }

    // Подготавливаем обновленные данные
    const updatedNutritionData = {
      calories: currentRequest.calories,
      protein: currentRequest.protein,
      fat: currentRequest.fat,
      carbs: currentRequest.carbs
    };

    // Обновляем конкретный параметр
    updatedNutritionData[parameter] = validation.value;

    // Обновляем запрос в базе данных
    const updatedRequest = await requestService.updateRequest(requestId, updatedNutritionData);

    // Формируем обновленное сообщение
    const updatedMessage = formatNutritionData({
      dishName: currentRequest.dish_name,
      calories: updatedRequest.calories,
      protein: updatedRequest.protein,
      fat: updatedRequest.fat,
      carbs: updatedRequest.carbs,
      weight: currentRequest.weight
    });

    // Обновляем исходное сообщение с результатами
    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✏️ Корректировать результаты', `correct_${requestId}`)
    ]);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      undefined,
      updatedMessage,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup
      }
    );

    // Отправляем подтверждение
    await ctx.reply(MESSAGES.CORRECTION_SUCCESS);

    // Удаляем состояние корректировки
    correctionStates.delete(userId);

    logger.info('Correction completed successfully', {
      userId,
      requestId,
      parameter,
      oldValue: currentRequest[parameter],
      newValue: validation.value
    });

  } catch (error) {
    logger.error('Error in handleCorrectionInput', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });

    await ctx.reply(MESSAGES.ERROR);
    
    // Очищаем состояние при ошибке
    const userId = ctx.from.id;
    correctionStates.delete(userId);
  }
}

/**
 * Проверить, является ли сообщение корректировкой
 * @param {Object} ctx - Контекст Telegraf
 * @returns {boolean} - true если это корректировка
 */
function isCorrectionMessage(ctx) {
  const userId = ctx.from.id;
  return correctionStates.has(userId);
}

module.exports = {
  correctionHandler,
  handleCorrectionInput,
  isCorrectionMessage
};