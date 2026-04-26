/**
 * Сервис для тестирования различных моделей OpenAI
 * Позволяет сравнивать производительность и стоимость разных моделей
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { calculateCalories } = require('../utils/nutrition');
const https = require('https');
const http = require('http');

/**
 * Цены моделей за 1 миллион токенов (в долларах)
 * Обновлено с правильными названиями GPT-5 моделей
 */
const MODEL_PRICING = {
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    name: 'GPT-4o Mini',
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    available: true,
    requiresBase64: false,
    supportsVision: true
  },
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
    name: 'GPT-4o',
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    available: true,
    requiresBase64: false,
    supportsVision: true
  },
  'gpt-5.4': {
    input: 5.00,
    output: 15.00,
    name: 'GPT-5.4',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    available: true,
    requiresBase64: false,
    supportsVision: true
  },
  'gpt-5.4-mini': {
    input: 0.25,
    output: 1.00,
    name: 'GPT-5.4 Mini',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    available: true,
    requiresBase64: false,
    supportsVision: true
  },
  'gpt-5.4-nano': {
    input: 0.05,
    output: 0.20,
    name: 'GPT-5.4 Nano',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    available: true,
    requiresBase64: false,
    supportsVision: true
  },
  'gpt-5-mini': {
    input: 0.20,
    output: 0.80,
    name: 'GPT-5 Mini',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    available: true,
    requiresBase64: false,
    supportsVision: false
  },
  'gpt-5-nano': {
    input: 0.03,
    output: 0.12,
    name: 'GPT-5 Nano',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    available: true,
    requiresBase64: false,
    supportsVision: false
  },
  'gpt-4.1-nano-2025-04-14': {
    input: 0.10,
    output: 0.40,
    name: 'GPT-4.1 Nano',
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    available: true,
    requiresBase64: false,
    supportsVision: true
  },
  'gpt-4.1-mini-2025-04-14': {
    input: 0.40,
    output: 1.60,
    name: 'GPT-4.1 Mini',
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    available: true,
    requiresBase64: false,
    supportsVision: true
  }
};

class ModelTester {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000
    });
    this.testResults = [];
  }

  /**
   * Скачать изображение и конвертировать в base64
   * @param {string} imageUrl - URL изображения
   * @returns {Promise<string>} Base64 data URL
   */
  async downloadImageAsBase64(imageUrl) {
    return new Promise((resolve, reject) => {
      const protocol = imageUrl.startsWith('https') ? https : http;
      
      protocol.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          
          // Определяем MIME тип по заголовкам или расширению
          const contentType = response.headers['content-type'] || 'image/jpeg';
          const dataUrl = `data:${contentType};base64,${base64}`;
          
          resolve(dataUrl);
        });

        response.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Получить список доступных моделей
   * @returns {Array} Массив объектов с информацией о моделях
   */
  getAvailableModels() {
    return Object.entries(MODEL_PRICING).map(([id, info]) => ({
      id,
      name: info.name,
      inputPrice: info.input,
      outputPrice: info.output,
      available: info.available,
      supportsVision: info.supportsVision
    }));
  }

  /**
   * Рассчитать стоимость запроса
   * @param {string} modelId - ID модели
   * @param {Object} usage - Объект с информацией об использовании токенов
   * @returns {number} Стоимость в долларах
   */
  calculateCost(modelId, usage) {
    const pricing = MODEL_PRICING[modelId];
    if (!pricing) {
      logger.warn('Unknown model pricing', { modelId });
      return 0;
    }

    const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Тестировать модель на анализе еды по тексту
   * @param {string} modelId - ID модели для тестирования
   * @param {string} foodName - Название еды
   * @param {number} weight - Вес порции в граммах
   * @returns {Promise<Object>} Результат тестирования
   */
  async testModelByText(modelId, foodName, weight) {
    const startTime = Date.now();
    let prompt = 'N/A'; // Объявляем переменную в начале
    
    try {
      logger.info('Testing model by text', { modelId, foodName, weight });

      const pricing = MODEL_PRICING[modelId];
      if (!pricing) {
        throw new Error(`Модель ${modelId} не найдена`);
      }

      // Используем улучшенный промпт без примеров с нулями для всех моделей
      prompt = `Analyze food item: ${foodName}, weight: ${weight}g. Provide nutritional information in JSON format with fields: name (keep original Russian name), weight, protein, fat, carbs (all nutrients in grams for this portion). Calculate real nutritional values based on typical food composition.`;

      // Подготавливаем параметры запроса
      const requestParams = {
        model: modelId,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      // Добавляем response_format и токены
      if (pricing.useMaxCompletionTokens) {
        requestParams.response_format = { type: "json_object" };
        requestParams.max_completion_tokens = 150;
      } else {
        requestParams.response_format = { type: "json_object" };
        requestParams.max_tokens = 150;
      }

      // Добавляем temperature только для моделей, которые его поддерживают
      if (pricing.supportsTemperature) {
        requestParams.temperature = 0.3;
      }

      const response = await this.client.chat.completions.create(requestParams);

      const content = response.choices[0].message.content.trim();
      const usage = response.usage;
      const cost = this.calculateCost(modelId, usage);
      const duration = Date.now() - startTime;

      logger.info('Model text response', { 
        modelId,
        content, 
        tokens: usage.total_tokens,
        cost: `$${cost.toFixed(10)}`,
        duration: `${duration}ms`
      });

      // Парсим JSON
      let data;
      try {
        // Пробуем найти JSON в markdown блоке
        let jsonMatch = content.match(/```json\s*(\{[^`]+\})\s*```/);
        if (!jsonMatch) {
          jsonMatch = content.match(/\{[^}]+\}/);
        }
        
        if (!jsonMatch) {
          throw new Error('JSON не найден в ответе');
        }

        const jsonStr = jsonMatch[1] || jsonMatch[0];
        data = JSON.parse(jsonStr);
      } catch (parseError) {
        logger.error('JSON parse error', { content, error: parseError.message });
        
        // Возвращаем ошибку с сырым ответом
        return {
          modelId,
          modelName: pricing.name,
          error: `Ошибка парсинга JSON: ${parseError.message}`,
          duration: duration,
          timestamp: new Date().toISOString(),
          prompt: prompt,
          rawResponse: content || 'Empty response'
        };
      }

      // Валидация
      if (data.protein === undefined || data.fat === undefined || data.carbs === undefined) {
        throw new Error('Отсутствуют данные о питательности');
      }

      // Рассчитываем калории
      const calories = calculateCalories(data.protein, data.fat, data.carbs);

      const result = {
        modelId,
        modelName: pricing.name,
        dishName: data.name || foodName,
        calories: Math.round(calories),
        protein: Math.round(data.protein),
        fat: Math.round(data.fat),
        carbs: Math.round(data.carbs),
        weight: weight,
        tokens: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens
        },
        cost: cost,
        duration: duration,
        timestamp: new Date().toISOString(),
        prompt: prompt,
        rawResponse: content
      };

      // Сохраняем результат
      this.testResults.push(result);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error testing model', {
        modelId,
        foodName,
        weight,
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack
      });

      return {
        modelId,
        modelName: MODEL_PRICING[modelId]?.name || modelId,
        error: error.message,
        duration: duration,
        timestamp: new Date().toISOString(),
        prompt: prompt,
        rawResponse: error.response?.data || 'Error occurred'
      };
    }
  }

  /**
   * Тестировать модель на анализе фото
   * @param {string} modelId - ID модели для тестирования
   * @param {string} photoUrl - URL фотографии
   * @param {number|null} weight - Вес порции в граммах (опционально)
   * @returns {Promise<Object>} Результат тестирования
   */
  async testModelByPhoto(modelId, photoUrl, weight = null) {
    const startTime = Date.now();
    let prompt = 'N/A'; // Объявляем переменную в начале
    
    try {
      logger.info('Testing model by photo', { modelId, photoUrl, weight });

      const pricing = MODEL_PRICING[modelId];
      if (!pricing) {
        throw new Error(`Модель ${modelId} не найдена`);
      }

      // Проверяем поддержку Vision API
      if (!pricing.supportsVision) {
        return {
          modelId,
          modelName: pricing.name,
          error: 'Модель не поддерживает анализ изображений',
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          prompt: 'Vision API не поддерживается',
          rawResponse: 'Model does not support vision'
        };
      }

      // Используем улучшенный промпт без примеров с нулями для всех моделей
      prompt = weight
        ? `Analyze this food photo. Weight is ${weight}g. Provide nutritional information in JSON format with fields: name (in Russian), weight, protein, fat, carbs (all nutrients in grams). Calculate real nutritional values.`
        : `Analyze this food photo. Estimate portion weight and provide nutritional information in JSON format with fields: name (in Russian), weight, protein, fat, carbs (all nutrients in grams). Calculate real nutritional values.`;

      // Подготавливаем параметры запроса
      const requestParams = {
        model: modelId,
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
        ]
      };

      // Добавляем response_format только для моделей, которые его поддерживают
      if (pricing.useMaxCompletionTokens) {
        // Новые модели GPT-5 могут требовать другой подход
        requestParams.response_format = { type: "json_object" };
        requestParams.max_completion_tokens = 150;
      } else {
        requestParams.response_format = { type: "json_object" };
        requestParams.max_tokens = 150;
      }

      // Добавляем temperature только для моделей, которые его поддерживают
      if (pricing.supportsTemperature) {
        requestParams.temperature = 0.2;
      }

      const response = await this.client.chat.completions.create(requestParams);

      const content = response.choices[0].message.content.trim();
      const usage = response.usage;
      const cost = this.calculateCost(modelId, usage);
      const duration = Date.now() - startTime;

      logger.info('Model photo test response', { 
        modelId,
        content,
        tokens: usage.total_tokens,
        cost: `$${cost.toFixed(10)}`,
        duration: `${duration}ms`
      });

      // Парсим JSON
      let data;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        logger.error('JSON parse error', { content, error: parseError.message });
        
        // Возвращаем ошибку с сырым ответом
        return {
          modelId,
          modelName: pricing.name,
          error: `Ошибка парсинга JSON: ${parseError.message}`,
          duration: duration,
          timestamp: new Date().toISOString(),
          prompt: prompt,
          rawResponse: content || 'Empty response'
        };
      }

      // Валидация
      if (!data.name || 
          typeof data.weight !== 'number' ||
          typeof data.protein !== 'number' ||
          typeof data.fat !== 'number' ||
          typeof data.carbs !== 'number') {
        throw new Error('Неверный формат ответа');
      }

      // Рассчитываем калории
      const calories = calculateCalories(data.protein, data.fat, data.carbs);

      const result = {
        modelId,
        modelName: pricing.name,
        dishName: data.name,
        calories: Math.round(calories),
        protein: Math.round(data.protein),
        fat: Math.round(data.fat),
        carbs: Math.round(data.carbs),
        weight: data.weight,
        tokens: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens
        },
        cost: cost,
        duration: duration,
        timestamp: new Date().toISOString(),
        prompt: prompt,
        rawResponse: content
      };

      // Сохраняем результат
      this.testResults.push(result);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error testing model with photo', {
        modelId,
        photoUrl,
        weight,
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack
      });

      return {
        modelId,
        modelName: MODEL_PRICING[modelId]?.name || modelId,
        error: error.message,
        duration: duration,
        timestamp: new Date().toISOString(),
        prompt: prompt,
        rawResponse: error.response?.data || 'Error occurred'
      };
    }
  }

  /**
   * Получить все результаты тестирования
   * @returns {Array} Массив результатов
   */
  getAllResults() {
    return this.testResults;
  }

  /**
   * Очистить результаты тестирования
   */
  clearResults() {
    this.testResults = [];
    logger.info('Test results cleared');
  }

  /**
   * Получить статистику по результатам
   * @returns {Object} Статистика
   */
  getStatistics() {
    if (this.testResults.length === 0) {
      return null;
    }

    const successfulTests = this.testResults.filter(r => !r.error);
    const failedTests = this.testResults.filter(r => r.error);

    const totalCost = successfulTests.reduce((sum, r) => sum + r.cost, 0);
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    const totalTokens = successfulTests.reduce((sum, r) => sum + r.tokens.total, 0);

    return {
      totalTests: this.testResults.length,
      successful: successfulTests.length,
      failed: failedTests.length,
      totalCost: totalCost,
      avgDuration: Math.round(avgDuration),
      totalTokens: totalTokens
    };
  }

  /**
   * Форматировать результат для вывода в чат
   * @param {Object} result - Результат тестирования
   * @returns {string} Отформатированное сообщение
   */
  formatResult(result) {
    if (result.error) {
      return `❌ <b>${result.modelName}</b>\n\n` +
             `⚠️ Ошибка: ${result.error}\n` +
             `⏱ Время: ${result.duration}мс\n\n` +
             `📝 <b>Промпт:</b>\n<code>${result.prompt}</code>\n\n` +
             `📤 <b>Ответ:</b>\n<code>${result.rawResponse}</code>`;
    }

    return `✅ <b>${result.modelName}</b>\n\n` +
           `🍽 <b>${result.dishName}</b>\n` +
           `⚖️ Вес: ${result.weight}г\n\n` +
           `🔥 Калории: ${result.calories} ккал\n` +
           `🥩 Белки: ${result.protein}г\n` +
           `🧈 Жиры: ${result.fat}г\n` +
           `🍞 Углеводы: ${result.carbs}г\n\n` +
           `📊 <b>Статистика:</b>\n` +
           `🪙 Токены: ${result.tokens.total} (↑${result.tokens.input} ↓${result.tokens.output})\n` +
           `💰 Стоимость: $${result.cost.toFixed(10)}\n` +
           `⏱ Время: ${result.duration}мс\n\n` +
           `📝 <b>Промпт:</b>\n<code>${result.prompt}</code>\n\n` +
           `📤 <b>Ответ модели:</b>\n<code>${result.rawResponse}</code>`;
  }

  /**
   * Форматировать список всех результатов
   * @returns {string} Отформатированное сообщение
   */
  formatAllResults() {
    if (this.testResults.length === 0) {
      return '📊 Нет результатов тестирования';
    }

    const stats = this.getStatistics();
    
    let message = `📊 <b>Результаты тестирования моделей</b>\n\n`;
    message += `Всего тестов: ${stats.totalTests}\n`;
    message += `✅ Успешных: ${stats.successful}\n`;
    message += `❌ Ошибок: ${stats.failed}\n\n`;

    if (stats.successful > 0) {
      message += `💰 Общая стоимость: $${stats.totalCost.toFixed(10)}\n`;
      message += `🪙 Всего токенов: ${stats.totalTokens}\n`;
      message += `⏱ Среднее время: ${stats.avgDuration}мс\n\n`;
    }

    message += `<b>Детали по моделям:</b>\n\n`;

    this.testResults.forEach((result, index) => {
      if (result.error) {
        message += `${index + 1}. ❌ ${result.modelName}\n`;
        message += `   Ошибка: ${result.error}\n\n`;
      } else {
        message += `${index + 1}. ✅ ${result.modelName}\n`;
        message += `   ${result.dishName} (${result.weight}г)\n`;
        message += `   КБЖУ: ${result.calories}/${result.protein}/${result.fat}/${result.carbs}\n`;
        message += `   💰 $${result.cost.toFixed(10)} | 🪙 ${result.tokens.total} | ⏱ ${result.duration}мс\n\n`;
      }
    });

    return message;
  }
}

module.exports = new ModelTester();
