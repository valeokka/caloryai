/**
 * Обработчик команды /profile и управления профилем
 */

const { Markup } = require('telegraf');
const profileService = require('../../services/profileService');
const calorieCalculator = require('../../services/calorieCalculator');
const logger = require('../../utils/logger');

// Состояния для диалога заполнения профиля
const profileStates = new Map();

/**
 * Главное меню профиля
 */
async function profileHandler(ctx) {
  try {
    const telegramId = ctx.from.id;
    const profile = await profileService.getProfile(telegramId);

    if (!profile) {
      // Профиль не заполнен
      await ctx.reply(
        '👤 У вас еще нет профиля.\n\n' +
        'Профиль позволяет рассчитать вашу норму калорий по формуле Миффлина-Сан Жеора.\n\n' +
        '💡 Вы можете использовать бота и без профиля - просто отправляйте фото еды для анализа калорий.',
        Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Заполнить профиль', 'profile_create')],
          [Markup.button.callback('❌ Закрыть', 'profile_cancel')]
        ])
      );
    } else {
      // Профиль существует - показываем информацию
      const genderText = profile.gender === 'male' ? '👨 Мужской' : '👩 Женский';
      const activityLevels = calorieCalculator.getActivityLevels();
      const activityName = Object.values(activityLevels)
        .find(a => a.value === parseFloat(profile.activity_level))?.name || 'Неизвестно';
      
      const goalSource = profile.is_manual_goal ? '(установлена вручную)' : '(рассчитана автоматически)';

      await ctx.reply(
        `👤 Ваш профиль:\n\n` +
        `Пол: ${genderText}\n` +
        `Возраст: ${profile.age} лет\n` +
        `Вес: ${profile.weight} кг\n` +
        `Рост: ${profile.height} см\n` +
        `Активность: ${activityName}\n\n` +
        `🎯 Цель калорий: ${profile.calorie_goal} ккал/день ${goalSource}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🎯 Настроить цель', 'goal_mode_select')],
          [Markup.button.callback('🔄 Заполнить заново', 'profile_create')],
          [Markup.button.callback('🗑 Удалить профиль', 'profile_delete')],
          [Markup.button.callback('❌ Закрыть', 'profile_cancel')]
        ])
      );
    }
  } catch (error) {
    logger.error('Error in profileHandler', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    await ctx.reply('❌ Произошла ошибка при загрузке профиля.');
  }
}

/**
 * Обработчик callback-кнопок профиля
 */
async function profileCallbackHandler(ctx) {
  const callbackData = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  try {
    await ctx.answerCbQuery();

    if (callbackData === 'profile_create') {
      await startProfileCreation(ctx);
    } else if (callbackData === 'profile_change_goal') {
      await showGoalChangeMenu(ctx);
    } else if (callbackData === 'profile_goal_manual') {
      await startManualGoalInput(ctx);
    } else if (callbackData === 'profile_goal_recalculate') {
      await recalculateGoal(ctx);
    } else if (callbackData === 'profile_delete') {
      await deleteProfile(ctx);
    } else if (callbackData === 'profile_cancel') {
      await ctx.deleteMessage();
    }
  } catch (error) {
    logger.error('Error in profileCallbackHandler', {
      userId: telegramId,
      callbackData,
      error: error.message
    });
    await ctx.reply('❌ Произошла ошибка.');
  }
}

/**
 * Начать процесс создания профиля
 */
async function startProfileCreation(ctx) {
  const telegramId = ctx.from.id;
  
  profileStates.set(telegramId, { step: 'gender' });
  
  await ctx.editMessageText(
    '👤 Создание профиля\n\n' +
    'Профиль нужен для расчета вашей нормы калорий по формуле Миффлина-Сан Жеора.\n\n' +
    'Шаг 1/5: Выберите ваш пол',
    Markup.inlineKeyboard([
      [Markup.button.callback('👨 Мужской', 'profile_gender_male')],
      [Markup.button.callback('👩 Женский', 'profile_gender_female')],
      [Markup.button.callback('❌ Отмена', 'profile_cancel')]
    ])
  );
}

/**
 * Обработка выбора пола
 */
async function handleGenderSelection(ctx) {
  const telegramId = ctx.from.id;
  const gender = ctx.callbackQuery.data === 'profile_gender_male' ? 'male' : 'female';
  
  const state = profileStates.get(telegramId) || {};
  state.gender = gender;
  state.step = 'age';
  profileStates.set(telegramId, state);
  
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '👤 Создание профиля\n\n' +
    'Шаг 2/5: Введите ваш возраст (в годах)\n\n' +
    'Например: 25'
  );
}

/**
 * Показать меню изменения цели
 */
async function showGoalChangeMenu(ctx) {
  await ctx.editMessageText(
    '🎯 Изменение цели калорий\n\n' +
    'Выберите способ:',
    Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Ввести вручную', 'profile_goal_manual')],
      [Markup.button.callback('🔄 Пересчитать по формуле', 'profile_goal_recalculate')],
      [Markup.button.callback('◀️ Назад', 'profile_back')]
    ])
  );
}

/**
 * Начать ввод цели вручную
 */
async function startManualGoalInput(ctx) {
  const telegramId = ctx.from.id;
  
  profileStates.set(telegramId, { step: 'manual_goal' });
  
  await ctx.editMessageText(
    '🎯 Введите желаемую норму калорий в день\n\n' +
    'Например: 2000\n\n' +
    'Допустимый диапазон: 500-10000 ккал'
  );
}

/**
 * Пересчитать цель по формуле
 */
async function recalculateGoal(ctx) {
  const telegramId = ctx.from.id;
  
  try {
    const { profile, bmr, dailyCalories } = await profileService.recalculateCalorieGoal(telegramId);
    
    await ctx.editMessageText(
      '✅ Цель калорий пересчитана!\n\n' +
      `📊 Базальный метаболизм (BMR): ${bmr} ккал\n` +
      `🎯 Суточная норма: ${dailyCalories} ккал\n\n` +
      'Расчет выполнен по формуле Миффлина-Сан Жеора с учетом вашего уровня активности.'
    );
  } catch (error) {
    await ctx.editMessageText(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Удалить профиль
 */
async function deleteProfile(ctx) {
  const telegramId = ctx.from.id;
  
  try {
    await profileService.deleteProfile(telegramId);
    await ctx.editMessageText('✅ Профиль успешно удален.');
  } catch (error) {
    await ctx.editMessageText(`❌ Ошибка при удалении профиля: ${error.message}`);
  }
}

/**
 * Обработка текстовых сообщений для заполнения профиля
 */
async function handleProfileInput(ctx) {
  const telegramId = ctx.from.id;
  const state = profileStates.get(telegramId);
  
  if (!state) {
    return false; // Не в процессе заполнения профиля
  }

  const text = ctx.message.text.trim();

  try {
    if (state.step === 'age') {
      const age = parseInt(text);
      if (isNaN(age) || age <= 0 || age > 150) {
        await ctx.reply('❌ Пожалуйста, введите корректный возраст (от 1 до 150 лет)');
        return true;
      }
      state.age = age;
      state.step = 'weight';
      profileStates.set(telegramId, state);
      
      await ctx.reply(
        '👤 Создание профиля\n\n' +
        'Шаг 3/5: Введите ваш вес (в килограммах)\n\n' +
        'Например: 70 или 65.5'
      );
      return true;
    }

    if (state.step === 'weight') {
      const weight = parseFloat(text);
      if (isNaN(weight) || weight <= 0 || weight > 500) {
        await ctx.reply('❌ Пожалуйста, введите корректный вес (от 1 до 500 кг)');
        return true;
      }
      state.weight = weight;
      state.step = 'height';
      profileStates.set(telegramId, state);
      
      await ctx.reply(
        '👤 Создание профиля\n\n' +
        'Шаг 4/5: Введите ваш рост (в сантиметрах)\n\n' +
        'Например: 175'
      );
      return true;
    }

    if (state.step === 'height') {
      const height = parseInt(text);
      if (isNaN(height) || height <= 0 || height > 300) {
        await ctx.reply('❌ Пожалуйста, введите корректный рост (от 1 до 300 см)');
        return true;
      }
      state.height = height;
      state.step = 'activity';
      profileStates.set(telegramId, state);
      
      const activityLevels = calorieCalculator.getActivityLevels();
      await ctx.reply(
        '👤 Создание профиля\n\n' +
        'Шаг 5/5: Выберите уровень физической активности',
        Markup.inlineKeyboard([
          [Markup.button.callback(`${activityLevels.SEDENTARY.name}`, 'profile_activity_1.2')],
          [Markup.button.callback(`${activityLevels.LIGHT.name}`, 'profile_activity_1.375')],
          [Markup.button.callback(`${activityLevels.MODERATE.name}`, 'profile_activity_1.55')],
          [Markup.button.callback(`${activityLevels.HIGH.name}`, 'profile_activity_1.725')],
          [Markup.button.callback(`${activityLevels.VERY_HIGH.name}`, 'profile_activity_1.9')],
          [Markup.button.callback('❌ Отмена', 'profile_cancel')]
        ])
      );
      return true;
    }

    if (state.step === 'manual_goal') {
      const calorieGoal = parseInt(text);
      if (isNaN(calorieGoal) || calorieGoal <= 0 || calorieGoal > 10000) {
        await ctx.reply('❌ Пожалуйста, введите корректное значение (от 1 до 10000 ккал)');
        return true;
      }
      
      await profileService.updateCalorieGoalManually(telegramId, calorieGoal);
      profileStates.delete(telegramId);
      
      await ctx.reply(
        `✅ Цель калорий обновлена!\n\n` +
        `🎯 Новая цель: ${calorieGoal} ккал/день`
      );
      return true;
    }
  } catch (error) {
    logger.error('Error in handleProfileInput', {
      userId: telegramId,
      step: state.step,
      error: error.message
    });
    await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
  }

  return true;
}

/**
 * Обработка выбора уровня активности
 */
async function handleActivitySelection(ctx) {
  const telegramId = ctx.from.id;
  const state = profileStates.get(telegramId);
  
  if (!state || state.step !== 'activity') {
    return;
  }

  const activityLevel = parseFloat(ctx.callbackQuery.data.replace('profile_activity_', ''));
  state.activityLevel = activityLevel;
  
  try {
    await ctx.answerCbQuery();
    
    // Создаем профиль с расчетом калорий
    const { profile, bmr, dailyCalories } = await profileService.createOrUpdateProfile(telegramId, {
      gender: state.gender,
      age: state.age,
      weight: state.weight,
      height: state.height,
      activityLevel: state.activityLevel
    });
    
    profileStates.delete(telegramId);
    
    const genderText = state.gender === 'male' ? '👨 Мужской' : '👩 Женский';
    const activityLevels = calorieCalculator.getActivityLevels();
    const activityName = Object.values(activityLevels)
      .find(a => a.value === activityLevel)?.name || 'Неизвестно';
    
    await ctx.editMessageText(
      '✅ Профиль успешно создан!\n\n' +
      `👤 Ваши данные:\n` +
      `Пол: ${genderText}\n` +
      `Возраст: ${state.age} лет\n` +
      `Вес: ${state.weight} кг\n` +
      `Рост: ${state.height} см\n` +
      `Активность: ${activityName}\n\n` +
      `📊 Базальный метаболизм (BMR): ${bmr} ккал\n` +
      `🎯 Суточная норма калорий: ${dailyCalories} ккал\n\n` +
      'Расчет выполнен по формуле Миффлина-Сан Жеора.\n\n' +
      '📸 Теперь отправляйте фото еды для анализа калорий!\n' +
      'Используйте /profile для управления профилем.'
    );
  } catch (error) {
    logger.error('Error creating profile', {
      userId: telegramId,
      error: error.message
    });
    await ctx.editMessageText(`❌ Ошибка при создании профиля: ${error.message}`);
    profileStates.delete(telegramId);
  }
}

/**
 * Проверка, является ли сообщение частью диалога профиля
 */
function isProfileMessage(ctx) {
  const telegramId = ctx.from?.id;
  return profileStates.has(telegramId);
}

module.exports = {
  profileHandler,
  profileCallbackHandler,
  handleProfileInput,
  handleGenderSelection,
  handleActivitySelection,
  isProfileMessage
};
