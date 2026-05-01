/**
 * Обработчик команд для тестирования моделей
 */

const { Markup } = require('telegraf');
const modelTester = require('../../services/modelTester');
const logger = require('../../utils/logger');

// Хранилище состояний тестирования
const testStates = new Map();

// Хранилище последних выбранных моделей для каждого пользователя
const lastSelectedModels = new Map();

// Хранилище настроек детального вывода для каждого пользователя
const detailedOutputSettings = new Map();

/**
 * Команда /test - начать тестирование моделей
 * @param {Object} ctx - Контекст Telegraf
 */
async function testCommand(ctx) {
  try {
    const userId = ctx.from.id;
    
    logger.info('Test command received', { userId });

    const message = `🧪 <b>Тестирование моделей</b>\n\n` +
                   `Сначала выберите тип промпта:\n\n` +
                   `📝 <b>Простой</b> - краткий промпт\n` +
                   `🔬 <b>Детальный</b> - подробный промпт с правилами\n\n` +
                   `После выбора промпта вы сможете выбрать режим тестирования.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📝 Простой промпт', 'test_prompt_simple')],
      [Markup.button.callback('🔬 Детальный промпт', 'test_prompt_detailed')],
      [Markup.button.callback('📊 Показать результаты', 'test_show_results')],
      [Markup.button.callback('🗑 Очистить результаты', 'test_clear_results')],
      [Markup.button.callback('⚙️ Настройки', 'test_settings')]
    ]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    });

  } catch (error) {
    logger.error('Error in testCommand', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    await ctx.reply('⚠️ Произошла ошибка');
  }
}

/**
 * Обработчик callback для тестирования
 * @param {Object} ctx - Контекст Telegraf
 */
async function testCallbackHandler(ctx) {
  try {
    const callbackData = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    logger.info('Test callback received', { userId, callbackData });

    if (callbackData.startsWith('test_prompt_')) {
      await selectPrompt(ctx, callbackData);
    } else if (callbackData === 'test_mode_text') {
      await startTextTest(ctx);
    } else if (callbackData === 'test_mode_photo') {
      await startPhotoTest(ctx);
    } else if (callbackData === 'test_mode_analyze') {
      await startAnalyzeTest(ctx);
    } else if (callbackData === 'test_show_results') {
      await showResults(ctx);
    } else if (callbackData === 'test_clear_results') {
      await clearResults(ctx);
    } else if (callbackData === 'test_settings') {
      await showSettings(ctx);
    } else if (callbackData === 'test_toggle_detailed') {
      await toggleDetailedOutput(ctx);
    } else if (callbackData.startsWith('test_model_')) {
      await toggleModel(ctx, callbackData);
    } else if (callbackData === 'test_run') {
      await runTests(ctx);
    } else if (callbackData === 'test_cancel') {
      await cancelTest(ctx);
    } else if (callbackData === 'test_skip_weight') {
      await skipWeight(ctx);
    } else if (callbackData === 'test_back') {
      await testCommand(ctx);
    }

    await ctx.answerCbQuery();

  } catch (error) {
    logger.error('Error in testCallbackHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    await ctx.answerCbQuery('Произошла ошибка');
  }
}

/**
 * Выбрать тип промпта
 */
async function selectPrompt(ctx, callbackData) {
  const userId = ctx.from.id;
  const promptType = callbackData.replace('test_prompt_', '');

  const message = `🧪 <b>Тестирование моделей</b>\n\n` +
                 `Выбран промпт: <b>${promptType === 'simple' ? 'Простой' : 'Детальный'}</b>\n\n` +
                 `Теперь выберите режим тестирования:\n\n` +
                 `📝 <b>По тексту</b> - введите название блюда и вес\n` +
                 `📸 <b>По фото</b> - отправьте фото еды\n` +
                 `🔍 <b>Анализ фото</b> - только определение блюда и веса`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📝 Тест по тексту', 'test_mode_text')],
    [Markup.button.callback('📸 Тест по фото', 'test_mode_photo')],
    [Markup.button.callback('🔍 Анализ фото', 'test_mode_analyze')],
    [Markup.button.callback('🔙 Назад', 'test_back')]
  ]);

  // Сохраняем выбранный промпт
  testStates.set(userId, { promptType });

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard.reply_markup
  });

  logger.info('Prompt selected', { userId, promptType });
}

/**
 * Начать тестирование по тексту
 */
async function startTextTest(ctx) {
  const userId = ctx.from.id;
  const existingState = testStates.get(userId) || {};

  // Получаем последние выбранные модели или все доступные модели по умолчанию
  const availableModels = modelTester.getAvailableModels('text');
  const defaultModels = lastSelectedModels.get(userId) || availableModels.map(m => m.id);

  testStates.set(userId, {
    ...existingState,
    mode: 'text',
    step: 'waiting_food_name',
    selectedModels: defaultModels
  });

  await ctx.editMessageText(
    `📝 <b>Тестирование по тексту</b>\n\n` +
    `Промпт: <b>${existingState.promptType === 'detailed' ? 'Детальный' : 'Простой'}</b>\n\n` +
    `Введите название блюда:`,
    { parse_mode: 'HTML' }
  );

  logger.info('Started text test', { userId });
}

/**
 * Начать тестирование по фото
 */
async function startPhotoTest(ctx) {
  const userId = ctx.from.id;
  const existingState = testStates.get(userId) || {};

  // Получаем последние выбранные модели или все доступные модели с Vision по умолчанию
  const availableModels = modelTester.getAvailableModels('photo');
  const defaultModels = lastSelectedModels.get(userId) 
    ? lastSelectedModels.get(userId).filter(modelId => {
        // Фильтруем только модели с поддержкой Vision
        return availableModels.some(m => m.id === modelId);
      })
    : availableModels.map(m => m.id);

  testStates.set(userId, {
    ...existingState,
    mode: 'photo',
    step: 'waiting_photo',
    selectedModels: defaultModels
  });

  await ctx.editMessageText(
    `📸 <b>Тестирование по фото</b>\n\n` +
    `Промпт: <b>${existingState.promptType === 'detailed' ? 'Детальный' : 'Простой'}</b>\n\n` +
    `Отправьте фото еды:`,
    { parse_mode: 'HTML' }
  );

  logger.info('Started photo test', { userId });
}

/**
 * Начать режим анализа фото
 */
async function startAnalyzeTest(ctx) {
  const userId = ctx.from.id;
  const existingState = testStates.get(userId) || {};

  // Получаем последние выбранные модели или все доступные модели с Vision по умолчанию
  const availableModels = modelTester.getAvailableModels('photo');
  const defaultModels = lastSelectedModels.get(userId) 
    ? lastSelectedModels.get(userId).filter(modelId => {
        // Фильтруем только модели с поддержкой Vision
        return availableModels.some(m => m.id === modelId);
      })
    : availableModels.map(m => m.id);

  testStates.set(userId, {
    ...existingState,
    mode: 'analyze',
    step: 'waiting_photo',
    selectedModels: defaultModels
  });

  await ctx.editMessageText(
    `🔍 <b>Анализ фото</b>\n\n` +
    `Режим: только определение блюда и веса (без КБЖУ)\n\n` +
    `Отправьте фото еды:`,
    { parse_mode: 'HTML' }
  );

  logger.info('Started analyze test', { userId });
}

/**
 * Показать настройки тестирования
 */
async function showSettings(ctx) {
  const userId = ctx.from.id;
  const detailedOutput = detailedOutputSettings.get(userId) || false;

  const message = `⚙️ <b>Настройки тестирования</b>\n\n` +
                 `📝 <b>Детальный вывод:</b> ${detailedOutput ? '✅ Включен' : '❌ Выключен'}\n\n` +
                 `Когда детальный вывод включен, после каждого теста будет показан:\n` +
                 `• Промпт запроса\n` +
                 `• Полный ответ модели\n` +
                 `• Результаты парсинга\n` +
                 `• Статистика (токены, время, стоимость)`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(
      detailedOutput ? '❌ Выключить детальный вывод' : '✅ Включить детальный вывод',
      'test_toggle_detailed'
    )],
    [Markup.button.callback('🔙 Назад', 'test_back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard.reply_markup
  });
}

/**
 * Переключить детальный вывод
 */
async function toggleDetailedOutput(ctx) {
  const userId = ctx.from.id;
  const currentSetting = detailedOutputSettings.get(userId) || false;
  detailedOutputSettings.set(userId, !currentSetting);

  logger.info('Toggled detailed output', { userId, newValue: !currentSetting });

  // Обновляем сообщение с настройками
  await showSettings(ctx);
}

/**
 * Показать результаты тестирования
 */
async function showResults(ctx) {
  const message = modelTester.formatAllResults();
  
  await ctx.editMessageText(message, { 
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'test_back')]
    ]).reply_markup
  });
}

/**
 * Очистить результаты
 */
async function clearResults(ctx) {
  modelTester.clearResults();
  
  await ctx.editMessageText(
    `✅ Результаты очищены`,
    { 
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'test_back')]
      ]).reply_markup
    }
  );
}

/**
 * Создать кнопки выбора моделей
 */
function createModelButtons(models, selectedModels) {
  const buttons = models.map(model => {
    const isSelected = selectedModels.includes(model.id);
    const icon = isSelected ? '✅' : '⬜️';
    const statusIcon = model.available ? '' : '⚠️ ';
    return [Markup.button.callback(
      `${icon} ${statusIcon}${model.name} ($${model.inputPrice}/$${model.outputPrice})`,
      `test_model_${model.id}`
    )];
  });

  buttons.push([
    Markup.button.callback('▶️ Запустить тесты', 'test_run'),
    Markup.button.callback('❌ Отмена', 'test_cancel')
  ]);

  return buttons;
}

/**
 * Показать выбор моделей
 */
async function showModelSelection(ctx, userId) {
  const state = testStates.get(userId);
  const models = modelTester.getAvailableModels(state.mode === 'text' ? 'text' : 'photo');

  let modeText = '📝 Текст';
  if (state.mode === 'photo') {
    modeText = '📸 Фото';
  } else if (state.mode === 'analyze') {
    modeText = '🔍 Анализ';
  }

  let message = `🤖 <b>Выбор моделей</b>\n\n`;
  message += `Режим: ${modeText}\n`;
  
  if (state.mode === 'text') {
    message += `Блюдо: ${state.foodName}\n`;
    message += `Вес: ${state.weight}г\n\n`;
  } else {
    message += `Фото: получено\n`;
    if (state.weight) {
      message += `Вес: ${state.weight}г\n`;
    }
    message += `\n`;
  }

  message += `Выбрано моделей: ${state.selectedModels.length}\n\n`;
  message += `Выберите модели для тестирования:`;
  if (state.mode === 'photo' || state.mode === 'analyze') {
    message += `\n(Показаны только модели с поддержкой фото)`;
  }

  const buttons = createModelButtons(models, state.selectedModels);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard(buttons).reply_markup
  });
}

/**
 * Переключить выбор модели
 */
async function toggleModel(ctx, callbackData) {
  const userId = ctx.from.id;
  const state = testStates.get(userId);

  if (!state) {
    await ctx.editMessageText('⚠️ Сессия истекла. Начните заново с /test');
    return;
  }

  const modelId = callbackData.replace('test_model_', '');
  const index = state.selectedModels.indexOf(modelId);

  if (index === -1) {
    state.selectedModels.push(modelId);
  } else {
    state.selectedModels.splice(index, 1);
  }

  // Обновляем сообщение
  const models = modelTester.getAvailableModels(state.mode === 'text' ? 'text' : 'photo');
  
  let modeText = '📝 Текст';
  if (state.mode === 'photo') {
    modeText = '📸 Фото';
  } else if (state.mode === 'analyze') {
    modeText = '🔍 Анализ';
  }

  let message = `🤖 <b>Выбор моделей</b>\n\n`;
  message += `Режим: ${modeText}\n`;
  
  if (state.mode === 'text') {
    message += `Блюдо: ${state.foodName}\n`;
    message += `Вес: ${state.weight}г\n\n`;
  } else {
    message += `Фото: получено\n`;
    if (state.weight) {
      message += `Вес: ${state.weight}г\n`;
    }
    message += `\n`;
  }

  message += `Выбрано моделей: ${state.selectedModels.length}\n\n`;
  message += `Выберите модели для тестирования:`;
  if (state.mode === 'photo' || state.mode === 'analyze') {
    message += `\n(Показаны только модели с поддержкой фото)`;
  }

  const buttons = createModelButtons(models, state.selectedModels);

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard(buttons).reply_markup
  });
}

/**
 * Запустить тесты
 */
async function runTests(ctx) {
  const userId = ctx.from.id;
  const state = testStates.get(userId);

  if (!state) {
    await ctx.editMessageText('⚠️ Сессия истекла. Начните заново с /test');
    return;
  }

  if (state.selectedModels.length === 0) {
    await ctx.answerCbQuery('⚠️ Выберите хотя бы одну модель');
    return;
  }

  // Сохраняем выбранные модели для следующего раза
  lastSelectedModels.set(userId, [...state.selectedModels]);

  // Проверяем настройку детального вывода
  const detailedOutput = detailedOutputSettings.get(userId) || false;

  await ctx.editMessageText(
    `⏳ Запускаю тестирование ${state.selectedModels.length} моделей...\n\n` +
    `Это может занять некоторое время.`,
    { parse_mode: 'HTML' }
  );

  // Очищаем предыдущие результаты
  modelTester.clearResults();

  // Запускаем тесты
  for (const modelId of state.selectedModels) {
    let result;
    
    if (state.mode === 'text') {
      result = await modelTester.testModelByText(modelId, state.foodName, state.weight, state.promptType || 'simple');
    } else if (state.mode === 'analyze') {
      // Режим анализа - только название и вес
      result = await modelTester.testModelByAnalyze(modelId, state.photoUrl, state.weight || null);
    } else {
      // Обычный режим фото с КБЖУ
      result = await modelTester.testModelByPhoto(modelId, state.photoUrl, state.weight || null, state.promptType || 'simple');
    }

    // Если включен детальный вывод, отправляем результат каждой модели отдельно
    if (detailedOutput) {
      const detailedMessage = modelTester.formatResult(result);
      await ctx.reply(detailedMessage, { parse_mode: 'HTML' });
    }
  }

  // Отправляем сводную таблицу результатов
  const summaryMessage = modelTester.formatAllResults();
  await ctx.reply(summaryMessage, { parse_mode: 'HTML' });

  // Очищаем состояние
  testStates.delete(userId);

  logger.info('Tests completed', { userId, modelsCount: state.selectedModels.length, detailedOutput });
}

/**
 * Отменить тестирование
 */
async function cancelTest(ctx) {
  const userId = ctx.from.id;
  testStates.delete(userId);

  await ctx.editMessageText('❌ Тестирование отменено');
  
  logger.info('Test cancelled', { userId });
}

/**
 * Обработчик текстовых сообщений для тестирования
 */
async function handleTestInput(ctx) {
  const userId = ctx.from.id;
  const state = testStates.get(userId);

  if (!state) {
    return; // Не наше сообщение
  }

  const text = ctx.message.text;

  if (state.step === 'waiting_food_name') {
    state.foodName = text.trim();
    state.step = 'waiting_weight';

    await ctx.reply(
      `✅ Блюдо: <b>${state.foodName}</b>\n\n` +
      `Теперь введите вес порции в граммах:`,
      { parse_mode: 'HTML' }
    );

  } else if (state.step === 'waiting_weight') {
    const weight = parseInt(text, 10);

    if (isNaN(weight) || weight <= 0 || weight > 10000) {
      await ctx.reply('⚠️ Введите корректный вес (от 1 до 10000 грамм)');
      return;
    }

    state.weight = weight;
    state.step = 'selecting_models';

    await showModelSelection(ctx, userId);

  } else if (state.step === 'waiting_weight_optional') {
    // Для фото - опциональный вес
    const weight = parseInt(text, 10);

    if (isNaN(weight) || weight <= 0 || weight > 10000) {
      await ctx.reply('⚠️ Введите корректный вес (от 1 до 10000 грамм) или нажмите "Пропустить"');
      return;
    }

    state.weight = weight;
    state.step = 'selecting_models';

    await showModelSelection(ctx, userId);
  }
}

/**
 * Пропустить ввод веса (для фото)
 */
async function skipWeight(ctx) {
  const userId = ctx.from.id;
  const state = testStates.get(userId);

  if (!state) {
    await ctx.editMessageText('⚠️ Сессия истекла. Начните заново с /test');
    return;
  }

  state.weight = null;
  state.step = 'selecting_models';

  await showModelSelection(ctx, userId);
}

/**
 * Обработчик фото для тестирования
 */
async function handleTestPhoto(ctx) {
  const userId = ctx.from.id;
  const state = testStates.get(userId);

  if (!state || (state.mode !== 'photo' && state.mode !== 'analyze') || state.step !== 'waiting_photo') {
    return; // Не наше фото
  }

  try {
    // Получаем URL фото
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    state.photoUrl = photoUrl;
    state.step = 'waiting_weight_optional';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⏭ Пропустить (автоопределение)', 'test_skip_weight')],
      [Markup.button.callback('❌ Отмена', 'test_cancel')]
    ]);

    await ctx.reply(
      `✅ Фото получено\n\n` +
      `Введите вес порции в граммах или пропустите для автоопределения:`,
      { reply_markup: keyboard.reply_markup }
    );

  } catch (error) {
    logger.error('Error handling test photo', {
      userId,
      error: error.message
    });
    await ctx.reply('⚠️ Ошибка при обработке фото');
  }
}

/**
 * Проверить, является ли сообщение частью тестирования
 */
function isTestMessage(ctx) {
  const userId = ctx.from.id;
  return testStates.has(userId);
}

module.exports = {
  testCommand,
  testCallbackHandler,
  handleTestInput,
  handleTestPhoto,
  isTestMessage
};
