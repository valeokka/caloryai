/**
 * Обработчик дневника питания
 */

const { Markup } = require('telegraf');
const dailyReportsQueries = require('../../database/queries/dailyReports');
const logger = require('../../utils/logger');

/**
 * Показать дневник за сегодня
 */
async function showTodayDiary(ctx) {
  try {
    const telegramId = ctx.from.id;
    const today = new Date();
    
    const { report, meals } = await dailyReportsQueries.getDailyReportWithMeals(telegramId, today);
    
    // Форматируем дату
    const dateStr = today.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      weekday: 'long'
    });
    
    // Рассчитываем прогресс
    const caloriesPercent = report.target_calories > 0 
      ? Math.round((report.consumed_calories / report.target_calories) * 100)
      : 0;
    
    const caloriesRemaining = report.target_calories - report.consumed_calories;
    const proteinRemaining = report.target_protein - report.consumed_protein;
    const fatRemaining = report.target_fat - report.consumed_fat;
    const carbsRemaining = report.target_carbs - report.consumed_carbs;
    
    // Формируем сообщение
    let message = `📅 Дневник питания\n${dateStr}\n\n`;
    
    // Прогресс по калориям
    message += `🔥 Калории: ${report.consumed_calories} / ${report.target_calories} ккал (${caloriesPercent}%)\n`;
    if (caloriesRemaining > 0) {
      message += `   ✅ Осталось: ${caloriesRemaining} ккал\n`;
    } else {
      message += `   ⚠️ Превышение: ${Math.abs(caloriesRemaining)} ккал\n`;
    }
    
    message += `\n📊 Макронутриенты:\n`;
    message += `🥩 Белки: ${report.consumed_protein} / ${report.target_protein} г`;
    message += ` (${proteinRemaining > 0 ? '+' : ''}${proteinRemaining} г)\n`;
    message += `🧈 Жиры: ${report.consumed_fat} / ${report.target_fat} г`;
    message += ` (${fatRemaining > 0 ? '+' : ''}${fatRemaining} г)\n`;
    message += `🍞 Углеводы: ${report.consumed_carbs} / ${report.target_carbs} г`;
    message += ` (${carbsRemaining > 0 ? '+' : ''}${carbsRemaining} г)\n`;
    
    // Приемы пищи
    if (meals.length > 0) {
      message += `\n🍽 Приемы пищи (${meals.length}):\n\n`;
      
      meals.forEach((meal, index) => {
        const time = new Date(meal.meal_time).toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        message += `${index + 1}. ${meal.dish_name}\n`;
        message += `   ⏰ ${time} | `;
        message += `${Math.round(meal.calories)} ккал | `;
        message += `Б: ${Math.round(meal.protein)}г Ж: ${Math.round(meal.fat)}г У: ${Math.round(meal.carbs)}г\n`;
      });
    } else {
      message += `\n📝 Приемов пищи пока нет.\n`;
      message += `Отправьте фото еды, чтобы добавить прием пищи!`;
    }
    
    // Кнопки
    const buttons = [];
    
    if (meals.length > 0) {
      buttons.push([Markup.button.callback('🗑 Удалить прием пищи', 'diary_delete_meal')]);
    }
    
    buttons.push(
      [Markup.button.callback('📊 Статистика за неделю', 'diary_week')],
      [Markup.button.callback('🔄 Обновить', 'diary_today')],
      [Markup.button.callback('❌ Закрыть', 'diary_close')]
    );
    
    await ctx.reply(message, Markup.inlineKeyboard(buttons));
    
  } catch (error) {
    logger.error('Error in showTodayDiary', {
      userId: ctx.from?.id,
      error: error.message,
      stack: error.stack
    });
    await ctx.reply('❌ Произошла ошибка при загрузке дневника.');
  }
}

/**
 * Показать меню удаления приема пищи
 */
async function showDeleteMealMenu(ctx) {
  try {
    const telegramId = ctx.from.id;
    const today = new Date();
    
    const { meals } = await dailyReportsQueries.getDailyReportWithMeals(telegramId, today);
    
    if (meals.length === 0) {
      await ctx.answerCbQuery('Нет приемов пищи для удаления');
      return;
    }
    
    await ctx.answerCbQuery();
    
    const buttons = meals.map((meal, index) => {
      const time = new Date(meal.meal_time).toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return [Markup.button.callback(
        `${index + 1}. ${meal.dish_name} (${time})`,
        `diary_delete_${meal.id}`
      )];
    });
    
    buttons.push([Markup.button.callback('◀️ Назад', 'diary_today')]);
    
    await ctx.editMessageText(
      '🗑 Выберите прием пищи для удаления:',
      Markup.inlineKeyboard(buttons)
    );
    
  } catch (error) {
    logger.error('Error in showDeleteMealMenu', {
      userId: ctx.from?.id,
      error: error.message
    });
    await ctx.reply('❌ Произошла ошибка.');
  }
}

/**
 * Удалить прием пищи
 */
async function deleteMeal(ctx) {
  try {
    const telegramId = ctx.from.id;
    const mealId = parseInt(ctx.callbackQuery.data.replace('diary_delete_', ''));
    
    await ctx.answerCbQuery();
    
    const deletedMeal = await dailyReportsQueries.deleteMeal(mealId, telegramId);
    
    if (deletedMeal) {
      await ctx.answerCbQuery('✅ Прием пищи удален');
      // Показываем обновленный дневник
      await showTodayDiary(ctx);
    } else {
      await ctx.answerCbQuery('❌ Не удалось удалить');
    }
    
  } catch (error) {
    logger.error('Error in deleteMeal', {
      userId: ctx.from?.id,
      error: error.message
    });
    await ctx.answerCbQuery('❌ Ошибка при удалении');
  }
}

/**
 * Показать статистику за неделю
 */
async function showWeekStats(ctx) {
  try {
    const telegramId = ctx.from.id;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6); // Последние 7 дней
    
    const reports = await dailyReportsQueries.getReportsForPeriod(telegramId, startDate, endDate);
    
    if (reports.length === 0) {
      await ctx.answerCbQuery('Нет данных за неделю');
      return;
    }
    
    await ctx.answerCbQuery();
    
    // Рассчитываем средние значения
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let daysWithMeals = 0;
    
    reports.forEach(report => {
      if (report.meals_count > 0) {
        totalCalories += report.consumed_calories;
        totalProtein += report.consumed_protein;
        totalFat += report.consumed_fat;
        totalCarbs += report.consumed_carbs;
        daysWithMeals++;
      }
    });
    
    const avgCalories = daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0;
    const avgProtein = daysWithMeals > 0 ? Math.round(totalProtein / daysWithMeals) : 0;
    const avgFat = daysWithMeals > 0 ? Math.round(totalFat / daysWithMeals) : 0;
    const avgCarbs = daysWithMeals > 0 ? Math.round(totalCarbs / daysWithMeals) : 0;
    
    let message = `📊 Статистика за неделю\n\n`;
    message += `📅 Дней с записями: ${daysWithMeals} из ${reports.length}\n\n`;
    message += `📈 Средние значения в день:\n`;
    message += `🔥 Калории: ${avgCalories} ккал\n`;
    message += `🥩 Белки: ${avgProtein} г\n`;
    message += `🧈 Жиры: ${avgFat} г\n`;
    message += `🍞 Углеводы: ${avgCarbs} г\n\n`;
    
    message += `📋 По дням:\n`;
    reports.forEach(report => {
      const date = new Date(report.report_date).toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'short' 
      });
      const percent = report.target_calories > 0 
        ? Math.round((report.consumed_calories / report.target_calories) * 100)
        : 0;
      message += `${date}: ${report.consumed_calories} ккал (${percent}%) | ${report.meals_count} приемов\n`;
    });
    
    await ctx.editMessageText(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад к дневнику', 'diary_today')],
        [Markup.button.callback('❌ Закрыть', 'diary_close')]
      ])
    );
    
  } catch (error) {
    logger.error('Error in showWeekStats', {
      userId: ctx.from?.id,
      error: error.message
    });
    await ctx.reply('❌ Произошла ошибка при загрузке статистики.');
  }
}

/**
 * Обработчик callback для дневника
 */
async function diaryCallbackHandler(ctx) {
  const callbackData = ctx.callbackQuery.data;
  
  try {
    if (callbackData === 'diary_today') {
      await ctx.answerCbQuery();
      await ctx.deleteMessage();
      await showTodayDiary(ctx);
    } else if (callbackData === 'diary_delete_meal') {
      await showDeleteMealMenu(ctx);
    } else if (callbackData.startsWith('diary_delete_')) {
      await deleteMeal(ctx);
    } else if (callbackData === 'diary_week') {
      await showWeekStats(ctx);
    } else if (callbackData === 'diary_close') {
      await ctx.answerCbQuery();
      await ctx.deleteMessage();
    }
  } catch (error) {
    logger.error('Error in diaryCallbackHandler', {
      userId: ctx.from?.id,
      callbackData,
      error: error.message
    });
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
}

module.exports = {
  showTodayDiary,
  showDeleteMealMenu,
  deleteMeal,
  showWeekStats,
  diaryCallbackHandler
};
