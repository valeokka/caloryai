/**
 * Сервис для работы с OpenAI ChatGPT Vision API
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { OPENAI, MESSAGES } = require('../config/constants');

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
   * @returns {Promise<Object>} { dishName, calories, protein, fat, carbs }
   */
  async analyzeFood(photoUrl, weight = null) {
    try {
      logger.info('Analyzing food photo', { photoUrl, weight });

      const prompt = this._buildPrompt(weight);
      const result = await this._retryWithBackoff(async () => {
        return await this._callVisionAPI(photoUrl, prompt);
      });

      return result;
    } catch (error) {
      logger.error('Error in analyzeFood', { 
        photoUrl, 
        weight, 
        error: error.message,
        stack: error.stack
      });
      
      if (error.message.includes('timeout')) {
        throw new Error(MESSAGES.API_ERROR);
      }
      
      throw new Error(MESSAGES.API_ERROR);
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
   * @returns {Promise<Object>} Результат анализа
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
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    logger.info('OpenAI response received', { content });

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

    return result;
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
        
        if (i === maxRetries - 1) {
          break;
        }

        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s...
        logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`, {
          error: error.message
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
