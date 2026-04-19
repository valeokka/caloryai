/**
 * Обработчик управления целями и нутриентами
 */

const { Markup } = require('telegraf');
const profileService = require('../../services/profileService');
const nutritionCalculator = require('../../services/nutritionCalculator');
const logger = require('../../utils/logger');

// Состояния для диалога настройки целей
const goalStates = new Map();

/**
 * Показать меню выбора режима настройки цели
 */
async function showGoalModeSelection(ctx) {
  await ctx.editMessageText(
    '🎯 Настройка цели\n\n' +
    'Выберите режим настройки:',
    Markup.inlineKeyboard([
      [Markup.button.callback('⚡ Упрощенный (рекомендуется)', 'goal_mode_simple')],
      [Markup.button.callback('⚙️ Расширенный', 'goal_mode_advanced')],
      [Markup.button.callback('◀️ Назад', 'goal_back')]
    ])
  );
}

/**
 * Показать упрощенный режим выбора цели
 */
async function showSimpleModeGoals(ctx) {
  const presets = nutritionCalculator.getSimpleModePresets();
  
  const buttons = presets.map(preset => [
    Markup.button.callback(preset.label, `goal_simple_${preset.percent}`)
  ]);
  
  buttons.push([Markup.button.callback('◀️ Назад', 'goal_mode_select')]);
  
  await ctx.editMessageText(
    '⚡ Упрощенный режим\n\n' +
    'Выберите процент от вашей нормы калорий (TDEE):\n\n' +
    '🔻 Отрицательные значения - похудение\n' +
    '⚖️ 0% - поддержание веса\n' +
    '🔺 Положительные значения - набор массы\n\n' +
    'БЖУ будут рассчитаны автоматически в зависимости от цели.',
    Markup.inlineKeyboard(buttons)
  );
}

/**
 * Обработка выбора цели в упрощенном режиме
 */
async function handleSimpleGoalSelection(ctx) {
  const telegramId = ctx.from.id;
  const percent = parseInt(ctx.callbackQuery.data.replace('goal_simple_', ''));
  
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⏳ Рассчитываю...');
    
    const { profile, nutrition } = await profileService.setGoalSimple(telegramId, percent);
    
    const goalName = nutritionCalculator.getGoalName(nutrition.goal_type);
    
    await ctx.editMessageText(
      `✅ Цель установлена!\n\n` +
      `${goalName}\n` +
      `Процент от TDEE: ${nutrition.goal_percent > 0 ? '+' : ''}${nutrition.goal_percent}%\n\n` +
      `📊 Калории и макросы:\n` +
      `🔥 Калории: ${nutrition.target_calories} ккал/день\n` +
      `🥩 Белки: ${nutrition.protein_g} г (${nutrition.protein_per_kg} г/кг)\n` +
      `🧈 Жиры: ${nutrition.fat_g} г (${nutrition.fat_per_kg} г/кг)\n` +
      `🍞 Углеводы: ${nutrition.carbs_g} г\n\n` +
      `💡 Используйте /profile для изменения настроек`
    );
  } catch (error) {
    logger.error('Error setting simple goal', {
      userId: telegramId,
      percent,
      error: error.message
    });
    await ctx.editMessageText(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Показать расширенный режим
 */
async function showAdvancedMode(ctx) {
  const telegramId = ctx.from.id;
  
  goalStates.set(telegramId, { 
    step: 'advanced_choice',
    mode: 'advanced'
  });
  
  await ctx.editMessageText(
    '⚙️ Расширенный режим\n\n' +
    'Вы можете настроить:\n' +
    '• Процент от TDEE или калории напрямую\n' +
    '• Белки (г/кг веса)\n' +
    '• Жиры (г/кг веса)\n\n' +
    'Выберите, что хотите настроить:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📊 Калории/процент', 'goal_adv_calories')],
      [Markup.button.callback('🥩 Белки и жиры', 'goal_adv_macros')],
      [Markup.button.callback('✅ Применить дефолты', 'goal_adv_defaults')],
      [Markup.button.callback('◀️ Назад', 'goal_mode_select')]
    ])
  );
}

/**
 * Начать ввод калорий/процента
 */
async function startAdvancedCaloriesInput(ctx) {
  const telegramId = ctx.from.id;
  
  const state = goalStates.get(telegramId) || {};
  state.step = 'advanced_calories';
  goalStates.set(telegramId, state);
  
  await ctx.editMessageText(
    '📊 Настройка калорий\n\n' +
    'Введите процент от TDEE или калории напрямую:\n\n' +
    'Примеры:\n' +
    '• -15 (минус 15% от TDEE)\n' +
    '• +10 (плюс 10% от TDEE)\n' +
    '• 2000 (2000 ккал напрямую)\n\n' +
    'Отправьте число:'
  );
}

/**
 * Начать ввод макросов
 */
async function startAdvancedMacrosInput(ctx) {
  const telegramId = ctx.from.id;
  
  const state = goalStates.get(telegramId) || {};
  state.step = 'advanced_protein';
  goalStates.set(telegramId, state);
  
  await ctx.editMessageText(
    '🥩 Настройка белков\n\n' +
    'Введите количество белка в граммах на кг веса:\n\n' +
    'Рекомендации:\n' +
    '• Похудение: 2.0 г/кг\n' +
    '• Поддержание: 1.6 г/кг\n' +
    '• Набор массы: 1.7 г/кг\n\n' +
    'Отправьте число (например: 2.0):'
  );
}

/**
 * Применить дефолтные значения
 */
async function applyAdvancedDefaults(ctx) {
  const telegramId = ctx.from.id;
  
  const state = goalStates.get(telegramId) || {};
  state.step = 'advanced_percent_default';
  goalStates.set(telegramId, state);
  
  await ctx.editMessageText(
    '✅ Применить дефолтные значения\n\n' +
    'Выберите цель, и БЖУ будут установлены автоматически:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔻 Похудение (-15%)', 'goal_adv_def_-15')],
      [Markup.button.callback('⚖️ Поддержание (0%)', 'goal_adv_def_0')],
      [Markup.button.callback('🔺 Набор массы (+15%)', 'goal_adv_def_15')],
      [Markup.button.callback('◀️ Назад', 'goal_mode_advanced')]
    ])
  );
}

/**
 * Обработка дефолтных значений
 */
async function handleAdvancedDefaults(ctx) {
  const telegramId = ctx.from.id;
  const percent = parseInt(ctx.callbackQuery.data.replace('goal_adv_def_', ''));
  
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⏳ Рассчитываю...');
    
    const { profile, nutrition } = await profileService.setGoalAdvanced(telegramId, { percent });
    
    const goalName = nutritionCalculator.getGoalName(nutrition.goal_type);
    
    await ctx.editMessageText(
      `✅ Цель установлена!\n\n` +
      `${goalName}\n` +
      `Процент от TDEE: ${nutrition.goal_percent > 0 ? '+' : ''}${nutrition.goal_percent}%\n\n` +
      `📊 Калории и макросы:\n` +
      `🔥 Калории: ${nutrition.target_calories} ккал/день\n` +
      `🥩 Белки: ${nutrition.protein_g} г (${nutrition.protein_per_kg} г/кг)\n` +
      `🧈 Жиры: ${nutrition.fat_g} г (${nutrition.fat_per_kg} г/кг)\n` +
      `🍞 Углеводы: ${nutrition.carbs_g} г\n\n` +
      `💡 Используйте /profile для изменения настроек`
    );
    
    goalStates.delete(telegramId);
  } catch (error) {
    logger.error('Error setting advanced defaults', {
      userId: telegramId,
      percent,
      error: error.message
    });
    await ctx.editMessageText(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Обработка текстового ввода для расширенного режима
 */
async function handleAdvancedInput(ctx) {
  const telegramId = ctx.from.id;
  const state = goalStates.get(telegramId);
  
  if (!state) {
    return false;
  }

  const text = ctx.message.text.trim();

  try {
    if (state.step === 'advanced_calories') {
      const value = parseFloat(text);
      
      if (isNaN(value)) {
        await ctx.reply('❌ Пожалуйста, введите число');
        return true;
      }

      // Определяем: процент или калории
      if (Math.abs(value) <= 50) {
        // Это процент
        state.percent = value;
        delete state.calories;
      } else {
        // Это калории
        state.calories = Math.round(value);
        delete state.percent;
      }

      // Применяем
      await ctx.reply('⏳ Рассчитываю...');
      
      const { profile, nutrition } = await profileService.setGoalAdvanced(telegramId, {
        calories: state.calories,
        percent: state.percent
      });
      
      const goalName = nutritionCalculator.getGoalName(nutrition.goal_type);
      
      await ctx.reply(
        `✅ Цель установлена!\n\n` +
        `${goalName}\n` +
        `${state.calories ? `Калории: ${state.calories} ккал` : `Процент: ${state.percent > 0 ? '+' : ''}${state.percent}%`}\n\n` +
        `📊 Итоговые значения:\n` +
        `🔥 Калории: ${nutrition.target_calories} ккал/день\n` +
        `🥩 Белки: ${nutrition.protein_g} г (${nutrition.protein_per_kg} г/кг)\n` +
        `🧈 Жиры: ${nutrition.fat_g} г (${nutrition.fat_per_kg} г/кг)\n` +
        `🍞 Углеводы: ${nutrition.carbs_g} г`
      );
      
      goalStates.delete(telegramId);
      return true;
    }

    if (state.step === 'advanced_protein') {
      const proteinPerKg = parseFloat(text);
      
      if (isNaN(proteinPerKg) || proteinPerKg < 0.5 || proteinPerKg > 5) {
        await ctx.reply('❌ Введите значение от 0.5 до 5 г/кг');
        return true;
      }

      state.proteinPerKg = proteinPerKg;
      state.step = 'advanced_fat';
      goalStates.set(telegramId, state);
      
      await ctx.reply(
        '🧈 Настройка жиров\n\n' +
        'Введите количество жиров в граммах на кг веса:\n\n' +
        'Рекомендации:\n' +
        '• Похудение: 0.8 г/кг\n' +
        '• Поддержание: 0.9 г/кг\n' +
        '• Набор массы: 1.0 г/кг\n\n' +
        'Отправьте число (например: 0.9):'
      );
      return true;
    }

    if (state.step === 'advanced_fat') {
      const fatPerKg = parseFloat(text);
      
      if (isNaN(fatPerKg) || fatPerKg < 0.3 || fatPerKg > 3) {
        await ctx.reply('❌ Введите значение от 0.3 до 3 г/кг');
        return true;
      }

      state.fatPerKg = fatPerKg;
      
      // Применяем
      await ctx.reply('⏳ Рассчитываю...');
      
      const { profile, nutrition } = await profileService.setGoalAdvanced(telegramId, {
        percent: state.percent || 0,
        proteinPerKg: state.proteinPerKg,
        fatPerKg: state.fatPerKg
      });
      
      const goalName = nutritionCalculator.getGoalName(nutrition.goal_type);
      
      await ctx.reply(
        `✅ Макросы установлены!\n\n` +
        `${goalName}\n\n` +
        `📊 Калории и макросы:\n` +
        `🔥 Калории: ${nutrition.target_calories} ккал/день\n` +
        `🥩 Белки: ${nutrition.protein_g} г (${nutrition.protein_per_kg} г/кг)\n` +
        `🧈 Жиры: ${nutrition.fat_g} г (${nutrition.fat_per_kg} г/кг)\n` +
        `🍞 Углеводы: ${nutrition.carbs_g} г`
      );
      
      goalStates.delete(telegramId);
      return true;
    }
  } catch (error) {
    logger.error('Error in handleAdvancedInput', {
      userId: telegramId,
      step: state.step,
      error: error.message
    });
    await ctx.reply(`❌ Ошибка: ${error.message}`);
    goalStates.delete(telegramId);
  }

  return true;
}

/**
 * Проверка, является ли сообщение частью диалога целей
 */
function isGoalMessage(ctx) {
  const telegramId = ctx.from?.id;
  return goalStates.has(telegramId);
}

module.exports = {
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
};
