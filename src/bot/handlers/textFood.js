/**
 * Обработчик добавления еды через текст
 */

const { Markup } = require('telegraf');
const requestService = require('../../services/requestService');
const profileService = require('../../services/profileService');
const openaiService = require('../../services/openai');
const dailyReportsQueries = require('../../database/queries/dailyReports');
const { formatNutritionData } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Парсинг текста для извлечения названия еды и веса
 * Примеры:
 * "Куриная грудка 200г" -> { food: "Куриная грудка", weight: 200 }
 * "Рис 150" -> { food: "Рис", weight: 150 }
 * "Яблоко 100 грамм" -> { food: "Яблоко", weight: 100 }
 */
function parseFoodText(text) {
  // Убираем лишние пробелы
  text = text.trim();
  
  // Паттерны для поиска веса
  const patterns = [
    /^(.+?)\s+(\d+)\s*г(?:рамм)?$/i,  // "Еда 200г" или "Еда 200 грамм"
    /^(.+?)\s+(\d+)$/,                 // "Еда 200"
    /^(\d+)\s*г(?:рамм)?\s+(.+)$/i,   // "200г Еда"
    /^(\d+)\s+(.+)$/                   // "200 Еда"
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Определяем порядок (еда-вес или вес-еда)
      if (pattern.source.startsWith('^(.+?)')) {
        // Еда идет первой
        return {
          food: match[1].trim(),
          weight: parseInt(match[2])
        };
      } else {
        // Вес идет первым
        return {
          food: match[2].trim(),
          weight: parseInt(match[1])
        };
      }
    }
  }
  
  return null;
}

/**
 * Проверка, является ли текст описанием еды
 */
function isFoodText(text) {
  if (!text || text.length < 3 || text.length > 200) {
    return false;
  }
  
  // Проверяем наличие цифр (вес)
  if (!/\d+/.test(text)) {
    return false;
  }
  
  // Пытаемся распарсить
  const parsed = parseFoodText(text);
  return parsed !== null && parsed.weight > 0 && parsed.weight < 5000;
}

/**
 * Обработка добавления еды через текст
 */
async function handleTextFood(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  
  try {
    // Парсим текст
    const parsed = parseFoodText(text);
    
    if (!parsed) {
      return false; // Не удалось распарсить
    }
    
    logger.info('Text food parsed', { 
      userId, 
      food: parsed.food, 
      weight: parsed.weight 
    });
    
    // Проверяем лимиты
    const requestResult = await requestService.consumeRequestAtomic(userId);
    
    if (!requestResult.allowed) {
      const { showPaymentMethods } = require('./payment');
      await showPaymentMethods(ctx, requestResult.reason);
      return true;
    }
    
    // Отправляем сообщение о начале обработки
    const processingMsg = await ctx.reply('⏳ Анализирую...');
    
    // Анализируем через OpenAI (без фото, только текст)
    const nutritionData = await openaiService.analyzeFoodByText(parsed.food, parsed.weight);
    
    logger.info('Text food analyzed', { 
      userId,
      food: parsed.food,
      weight: parsed.weight,
      nutritionData 
    });
    
    // Сохраняем результат (без photo_file_id)
    const savedRequest = await requestService.saveRequest(
      userId,
      null, // нет photo_file_id
      nutritionData,
      parsed.weight
    );
    
    // Обновляем дневной отчет
    await dailyReportsQueries.getOrCreateDailyReport(userId);
    await dailyReportsQueries.updateConsumedValues(userId);
    
    // Удаляем сообщение "Анализирую..."
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    
    // Проверяем наличие профиля для показа прогресса
    const profile = await profileService.getProfile(userId);
    let message = formatNutritionData(nutritionData);
    
    // Добавляем информацию о прогрессе, если есть профиль
    if (profile && profile.target_calories) {
      const percentage = ((nutritionData.calories / profile.target_calories) * 100).toFixed(1);
      const remaining = profile.target_calories - nutritionData.calories;
      
      message += `\n\n📊 <b>Прогресс по цели:</b>\n`;
      message += `🎯 Цель: ${profile.target_calories} ккал/день\n`;
      message += `📈 Это блюдо: ${percentage}% от дневной нормы\n`;
      
      if (remaining > 0) {
        message += `✅ Осталось: ${remaining.toFixed(0)} ккал`;
      } else {
        message += `⚠️ Превышение: ${Math.abs(remaining).toFixed(0)} ккал`;
      }
    }
    
    // Отправляем результат
    await ctx.reply(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✏️ Корректировать результаты', `correct_${savedRequest.id}`)
        ])
      }
    );
    
    logger.info('Text food added successfully', {
      userId,
      requestId: savedRequest.id,
      food: parsed.food,
      weight: parsed.weight
    });
    
    return true;
    
  } catch (error) {
    logger.error('Error in handleTextFood', {
      userId,
      text,
      error: error.message,
      stack: error.stack
    });
    
    await ctx.reply('❌ Произошла ошибка при анализе. Попробуйте еще раз.');
    return true;
  }
}

module.exports = {
  parseFoodText,
  isFoodText,
  handleTextFood
};
