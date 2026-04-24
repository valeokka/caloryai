/**
 * Обработчик корректировки результатов
 */

const { Markup } = require('telegraf');
const requestService = require('../../services/requestService');
const { validateNutritionValue } = require('../../utils/validator');
const { formatNutritionData } = require('../../utils/formatter');
const { calculateCalories, recalculateByWeight } = require('../../utils/nutrition');
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
      Markup.button.callback('📝 Название', `edit_name_${requestId}`)
    ],
    [
      Markup.button.callback('⚖️ Вес', `edit_weight_${requestId}`)
    ],
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
    name: 'Название блюда',
    weight: 'Вес (г)',
    calories: 'Калории',
    protein: 'Белки',
    fat: 'Жиры',
    carbs: 'Углеводы'
  };

  const parameterName = parameterNames[parameter];

  // Для названия - другой промпт
  const promptMessage = parameter === 'name' 
    ? `✏️ Редактирование: <b>${parameterName}</b>\n\nВведите новое название блюда:`
    : `✏️ Редактирование: <b>${parameterName}</b>\n\n${MESSAGES.CORRECTION_PROMPT}`;

  // Отправляем запрос на ввод нового значения
  await ctx.reply(promptMessage, { parse_mode: 'HTML' });

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

    // Получаем название параметра для валидации (только для числовых параметров)
    const parameterNames = {
      weight: 'Вес',
      calories: 'Калории',
      protein: 'Белки',
      fat: 'Жиры',
      carbs: 'Углеводы'
    };

    const parameterName = parameterNames[parameter];

    // Получаем текущие данные запроса
    const requestQueries = require('../../database/queries/requests');
    const currentRequest = await requestQueries.getRequestById(requestId);

    if (!currentRequest) {
      await ctx.reply('Запрос не найден');
      correctionStates.delete(userId);
      return;
    }

    // Подготавливаем обновленные данные
    let updatedNutritionData = {
      calories: currentRequest.calories,
      protein: currentRequest.protein,
      fat: currentRequest.fat,
      carbs: currentRequest.carbs,
      weight: currentRequest.weight
    };

    // Если меняем название - получаем новые данные КБЖУ через API
    if (parameter === 'name') {
      const newDishName = inputValue.trim();
      
      if (!newDishName) {
        await ctx.reply('Название блюда не может быть пустым');
        return;
      }

      await ctx.reply('🔄 Получаю данные для нового блюда...');

      // Получаем данные КБЖУ для нового блюда с текущим весом
      const openaiService = require('../../services/openai');
      const nutritionData = await openaiService.analyzeFoodByText(newDishName, currentRequest.weight);

      if (!nutritionData) {
        await ctx.reply('Не удалось получить данные для указанного блюда. Попробуйте другое название.');
        return;
      }

      updatedNutritionData = {
        dishName: nutritionData.dishName,
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        fat: nutritionData.fat,
        carbs: nutritionData.carbs,
        weight: nutritionData.weight
      };
    }
    // Валидируем введенное значение для числовых параметров
    else {
      const validation = validateNutritionValue(inputValue, parameterName);

      if (!validation.valid) {
        await ctx.reply(validation.error);
        return;
      }

      // Если меняем вес - пересчитываем все значения включая калории
      if (parameter === 'weight') {
        updatedNutritionData = recalculateByWeight(currentRequest, validation.value);
      } 
      // Если меняем БЖУ - пересчитываем калории
      else if (parameter === 'protein' || parameter === 'fat' || parameter === 'carbs') {
        updatedNutritionData[parameter] = validation.value;
        updatedNutritionData.calories = calculateCalories(
          updatedNutritionData.protein,
          updatedNutritionData.fat,
          updatedNutritionData.carbs
        );
      } 
      // Если меняем калории напрямую - просто обновляем
      else {
        updatedNutritionData[parameter] = validation.value;
      }
    }

    // Обновляем запрос в базе данных
    const updatedRequest = await requestService.updateRequest(requestId, updatedNutritionData);

    // Формируем обновленное сообщение
    const updatedMessage = formatNutritionData({
      dishName: updatedNutritionData.dishName || currentRequest.dish_name,
      calories: updatedRequest.calories,
      protein: updatedRequest.protein,
      fat: updatedRequest.fat,
      carbs: updatedRequest.carbs,
      weight: updatedRequest.weight
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
      newValue: parameter === 'name' ? updatedNutritionData.dishName : updatedNutritionData[parameter]
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