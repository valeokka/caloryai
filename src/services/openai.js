/**
 * Сервис для работы с OpenAI ChatGPT Vision API
 * Оптимизирован для gpt-4o-mini с low качеством изображений
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { VALIDATION } = require('../config/constants');

const PRICING = {
  'gpt-4o-mini': {
    input: 0.00015,
    output: 0.0006
  }
};

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000
    });
  }

  /**
   * Анализировать фотографию еды
   * @param {string} photoUrl - URL фотографии
   * @param {number|null} weight - Вес порции в граммах
   * @returns {Promise<Object>} { dishName, calories, protein, fat, carbs, weight, cost, tokens }
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
        cost: `${result.cost.toFixed(4)}`
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error in analyzeFood', { 
        photoUrl, 
        weight, 
        duration: `${duration}ms`,
        error: error.message
      });
      
      throw this._handleOpenAIError(error);
    }
  }

  /**
   * Построить промпт для ChatGPT
   */
  _buildPrompt(weight) {
    if (weight) {
      return `Food photo analysis. Weight: ${weight}g. Dish name in Russian. JSON only: {"name":"","weight":${weight},"kcal":0,"protein":0,"fat":0,"carbs":0}`;
    }
    return `Food photo analysis. Estimate portion weight in grams. Dish name in Russian. JSON only: {"name":"","weight":0,"kcal":0,"protein":0,"fat":0,"carbs":0}`;
  }

  /**
   * Вызвать Vision API
   */
  async _callVisionAPI(photoUrl, prompt) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: photoUrl,
                detail: 'low'
              } 
            }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const usage = response.usage;
    const cost = this._calculateCost(usage);
    
    logger.info('OpenAI response', { 
      content,
      tokens: usage.total_tokens,
      cost: `${cost.toFixed(4)}`
    });

    // Парсим JSON
    const data = JSON.parse(content);

    // Валидация структуры
    if (!data.name || 
        typeof data.weight !== 'number' ||
        typeof data.kcal !== 'number' ||
        typeof data.protein !== 'number' ||
        typeof data.fat !== 'number' ||
        typeof data.carbs !== 'number') {
      throw new Error('Invalid response format from OpenAI');
    }

    // Проверка на отрицательные значения
    if (data.weight < 0 || data.kcal < 0 || data.protein < 0 || data.fat < 0 || data.carbs < 0) {
      logger.warn('Negative values', data);
      throw new Error('Invalid nutrition values');
    }

    // Проверка на нереалистичные значения
    if (data.kcal > VALIDATION.NUTRITION.MAX_CALORIES ||
        data.protein > VALIDATION.NUTRITION.MAX_PROTEIN ||
        data.fat > VALIDATION.NUTRITION.MAX_FAT ||
        data.carbs > VALIDATION.NUTRITION.MAX_CARBS) {
      logger.warn('Unrealistic values', data);
      throw new Error('Unrealistic nutrition values');
    }

    // Преобразуем в формат для совместимости с остальным кодом
    return {
      dishName: data.name,
      calories: data.kcal,
      protein: data.protein,
      fat: data.fat,
      carbs: data.carbs,
      weight: data.weight,
      cost: cost,
      tokens: usage.total_tokens
    };
  }

  /**
   * Рассчитать стоимость запроса
   */
  _calculateCost(usage) {
    const pricing = PRICING['gpt-4o-mini'];
    const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Обработать ошибки OpenAI
   */
  _handleOpenAIError(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('timeout')) {
      const err = new Error('⚠️ Превышено время ожидания. Попробуй ещё раз.');
      err.type = 'timeout';
      return err;
    }
    
    if (errorMessage.includes('rate limit') || error.status === 429) {
      const err = new Error('⚠️ Слишком много запросов. Попробуй через минуту.');
      err.type = 'rate_limit';
      return err;
    }
    
    if (errorMessage.includes('authentication') || error.status === 401) {
      logger.error('OpenAI auth error');
      const err = new Error('⚠️ Ошибка сервиса. Попробуй позже.');
      err.type = 'auth';
      return err;
    }
    
    if (errorMessage.includes('quota') || error.status === 402) {
      logger.error('OpenAI quota exceeded');
      const err = new Error('⚠️ Сервис временно недоступен.');
      err.type = 'quota';
      return err;
    }
    
    if (errorMessage.includes('content') || error.status === 400) {
      const err = new Error('⚠️ Не удалось обработать изображение. Попробуй другое фото.');
      err.type = 'content';
      return err;
    }
    
    const err = new Error('⚠️ Ошибка обработки. Попробуй ещё раз.');
    err.type = 'unknown';
    return err;
  }

  /**
   * Retry с экспоненциальной задержкой
   */
  async _retryWithBackoff(fn, maxRetries = 2) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Не ретраим критичные ошибки
        if (error.status === 401 || error.status === 400 || error.status === 402) {
          break;
        }
        
        if (i === maxRetries - 1) break;

        const delay = Math.pow(2, i) * 1000;
        logger.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

module.exports = new OpenAIService();
