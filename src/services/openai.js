/**
 * Сервис для работы с OpenAI ChatGPT Vision API
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { OPENAI, MESSAGES, VALIDATION } = require('../config/constants');

// Примерные цены OpenAI (обновляйте по актуальным тарифам)
const PRICING = {
  'gpt-4o': {
    input: 0.005,  // $ за 1K токенов
    output: 0.015  // $ за 1K токенов
  },
  'gpt-4-turbo': {
    input: 0.01,
    output: 0.03
  }
};

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI.TIMEOUT
    });
  }

  /**
   * Анализировать фотографию еды
   * @param {string} photoUrl - URL фотографии
   * @param {number|null} weight - Вес порции в граммах
   * @returns {Promise<Object>} { dishName, calories, protein, fat, carbs, cost }
   */
  async analyzeFood(photoUrl, weight = null) {
    const startTime = Date.now();
    
    try {
      logger.info('Analyzing food photo', { photoUrl, weight });

      const prompt = this._buildPrompt(weight);
      const result = await this._retryWithBackoff(async () => {
        return await this._callVisionAPI(photoUrl, prompt);
      });

      const duration = Date.now() - startTime;
      logger.info('Food analysis completed', { 
        duration: `${duration}ms`,
        cost: result.cost ? `$${result.cost.toFixed(4)}` : 'unknown'
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error in analyzeFood', { 
        photoUrl, 
        weight, 
        duration: `${duration}ms`,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack
      });
      
      // Улучшенная обработка ошибок
      throw this._handleOpenAIError(error);
    }
  }

  /**
   * Построить промпт для ChatGPT
   * @param {number|null} weight - Вес порции в граммах
   * @returns {string} Промпт
   */
  _buildPrompt(weight) {
    let prompt = `Проанализируй это изображение еды и предоставь следующую информацию:
1. Название блюда
2. Калорийность (ккал)
3. Белки (г)
4. Жиры (г)
5. Углеводы (г)

`;

    if (weight) {
      prompt += `Вес порции: ${weight}г. Рассчитай пищевую ценность для этого веса.\n\n`;
    } else {
      prompt += `Определи примерный вес порции по фото и рассчитай пищевую ценность.\n\n`;
    }

    prompt += `Ответь СТРОГО в формате JSON без дополнительного текста:
{
  "dishName": "название блюда",
  "calories": число,
  "protein": число,
  "fat": число,
  "carbs": число
}`;

    return prompt;
  }

  /**
   * Вызвать Vision API
   * @param {string} photoUrl - URL фотографии
   * @param {string} prompt - Промпт для анализа
   * @returns {Promise<Object>} Результат анализа с информацией о стоимости
   */
  async _callVisionAPI(photoUrl, prompt) {
    const response = await this.client.chat.completions.create({
      model: OPENAI.MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: photoUrl } }
          ]
        }
      ],
      max_tokens: OPENAI.MAX_TOKENS
    });

    const content = response.choices[0].message.content;
    const usage = response.usage;

    // Рассчитываем стоимость запроса
    const cost = this._calculateCost(usage, OPENAI.MODEL);
    
    logger.info('OpenAI response received', { 
      content,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      },
      cost: `$${cost.toFixed(4)}`
    });

    // Парсим JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from OpenAI response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Валидация результата
    if (!result.dishName || 
        typeof result.calories !== 'number' ||
        typeof result.protein !== 'number' ||
        typeof result.fat !== 'number' ||
        typeof result.carbs !== 'number') {
      throw new Error('Invalid response format from OpenAI');
    }

    // Проверка на отрицательные значения
    if (result.calories < 0 || result.protein < 0 || result.fat < 0 || result.carbs < 0) {
      logger.warn('OpenAI returned negative values', result);
      throw new Error('Invalid nutrition values from OpenAI');
    }

    // Проверка на нереалистично большие значения
    if (result.calories > VALIDATION.NUTRITION.MAX_CALORIES ||
        result.protein > VALIDATION.NUTRITION.MAX_PROTEIN ||
        result.fat > VALIDATION.NUTRITION.MAX_FAT ||
        result.carbs > VALIDATION.NUTRITION.MAX_CARBS) {
      logger.warn('OpenAI returned unrealistic values', result);
      throw new Error('Unrealistic nutrition values from OpenAI');
    }

    // Добавляем информацию о стоимости
    result.cost = cost;
    result.tokens = usage.total_tokens;

    return result;
  }

  /**
   * Рассчитать стоимость запроса
   * @param {Object} usage - Информация об использовании токенов
   * @param {string} model - Модель OpenAI
   * @returns {number} Стоимость в долларах
   */
  _calculateCost(usage, model) {
    const pricing = PRICING[model] || PRICING['gpt-4o'];
    const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Обработать ошибки OpenAI и вернуть понятное сообщение
   * @param {Error} error - Ошибка от OpenAI
   * @returns {Error} Обработанная ошибка с понятным сообщением
   */
  _handleOpenAIError(error) {
    const errorMessage = error.message.toLowerCase();
    
    // Timeout ошибки
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      const err = new Error(MESSAGES.API_ERROR);
      err.type = 'timeout';
      return err;
    }
    
    // Rate limit ошибки
    if (errorMessage.includes('rate limit') || error.status === 429) {
      const err = new Error('⚠️ Слишком много запросов к AI. Попробуй через минуту.');
      err.type = 'rate_limit';
      return err;
    }
    
    // Ошибки аутентификации
    if (errorMessage.includes('authentication') || 
        errorMessage.includes('api key') || 
        error.status === 401) {
      logger.error('OpenAI authentication error - check API key');
      const err = new Error(MESSAGES.API_ERROR);
      err.type = 'auth';
      return err;
    }
    
    // Ошибки недостаточного баланса
    if (errorMessage.includes('insufficient') || 
        errorMessage.includes('quota') ||
        error.status === 402) {
      logger.error('OpenAI quota exceeded - check billing');
      const err = new Error('⚠️ Сервис временно недоступен. Попробуй позже.');
      err.type = 'quota';
      return err;
    }
    
    // Ошибки контента (модерация)
    if (errorMessage.includes('content policy') || 
        errorMessage.includes('safety') ||
        error.status === 400) {
      const err = new Error('⚠️ Не удалось обработать это изображение. Попробуй другое фото.');
      err.type = 'content';
      return err;
    }
    
    // Общая ошибка API
    const err = new Error(MESSAGES.API_ERROR);
    err.type = 'unknown';
    return err;
  }

  /**
   * Retry логика с экспоненциальной задержкой
   * @param {Function} fn - Функция для выполнения
   * @param {number} maxRetries - Максимальное количество попыток
   * @returns {Promise<any>} Результат выполнения функции
   */
  async _retryWithBackoff(fn, maxRetries = OPENAI.MAX_RETRIES) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Не ретраим ошибки аутентификации и контента
        if (error.status === 401 || error.status === 400 || error.status === 402) {
          break;
        }
        
        if (i === maxRetries - 1) {
          break;
        }

        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s...
        logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`, {
          error: error.message,
          status: error.status
        });
        
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Вспомогательная функция для задержки
   * @param {number} ms - Миллисекунды
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new OpenAIService();
