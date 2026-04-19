/**
 * Модуль валидации данных
 */

const { VALIDATION } = require('../config/constants');

/**
 * Проверяет, является ли значение положительным числом
 * @param {*} value - Значение для проверки
 * @returns {boolean} - true если значение является положительным числом
 */
function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Валидирует значение пищевой ценности
 * @param {*} value - Значение для валидации
 * @param {string} fieldName - Название поля (для сообщения об ошибке)
 * @returns {Object} - { valid: boolean, error: string|null, value: number|null }
 */
function validateNutritionValue(value, fieldName = 'Значение') {
  // Проверяем, что значение передано
  if (value === null || value === undefined || value === '') {
    return {
      valid: false,
      error: `${fieldName} не может быть пустым`,
      value: null
    };
  }

  // Преобразуем в число
  const num = Number(value);

  // Проверяем, что это число
  if (isNaN(num)) {
    return {
      valid: false,
      error: `${fieldName} должно быть числом`,
      value: null
    };
  }

  // Проверяем, что число положительное
  if (num <= 0) {
    return {
      valid: false,
      error: `${fieldName} должно быть положительным числом`,
      value: null
    };
  }

  // Проверяем, что число конечное
  if (!isFinite(num)) {
    return {
      valid: false,
      error: `${fieldName} должно быть конечным числом`,
      value: null
    };
  }

  // Проверяем разумные пределы для пищевой ценности
  // Максимальные значения на порцию
  const maxValues = {
    'Калории': VALIDATION.NUTRITION.MAX_CALORIES,
    'Белки': VALIDATION.NUTRITION.MAX_PROTEIN,
    'Жиры': VALIDATION.NUTRITION.MAX_FAT,
    'Углеводы': VALIDATION.NUTRITION.MAX_CARBS
  };

  const maxValue = maxValues[fieldName] || VALIDATION.NUTRITION.MAX_CALORIES;
  if (num > maxValue) {
    return {
      valid: false,
      error: `${fieldName} не может превышать ${maxValue}`,
      value: null
    };
  }

  // Округляем до заданного количества знаков после запятой
  const multiplier = Math.pow(10, VALIDATION.NUTRITION.DECIMAL_PLACES);
  const roundedValue = Math.round(num * multiplier) / multiplier;

  return {
    valid: true,
    error: null,
    value: roundedValue
  };
}

/**
 * Валидирует вес порции
 * @param {*} weight - Вес для валидации
 * @returns {Object} - { valid: boolean, error: string|null, value: number|null }
 */
function validateWeight(weight) {
  if (weight === null || weight === undefined) {
    return {
      valid: true,
      error: null,
      value: null
    };
  }

  const num = Number(weight);

  if (isNaN(num)) {
    return {
      valid: false,
      error: 'Вес должен быть числом',
      value: null
    };
  }

  if (num <= 0) {
    return {
      valid: false,
      error: 'Вес должен быть положительным числом',
      value: null
    };
  }

  if (num > VALIDATION.WEIGHT.ABSOLUTE_MAX) {
    return {
      valid: false,
      error: `Вес не может превышать ${VALIDATION.WEIGHT.ABSOLUTE_MAX} грамм`,
      value: null
    };
  }

  return {
    valid: true,
    error: null,
    value: Math.round(num)
  };
}

/**
 * Извлекает вес из текста (подписи к фото)
 * @param {string} text - Текст для парсинга
 * @returns {number|null} - Извлеченный вес или null
 */
function extractWeightFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Ищем число в тексте (может быть с единицами измерения)
  const patterns = [
    /(\d+)\s*г(?:рамм)?/i,  // "250 грамм" или "250г"
    /(\d+)\s*g/i,            // "250g"
    /^(\d+)$/                // Просто число "250"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const weight = parseInt(match[1], 10);
      const validation = validateWeight(weight);
      if (validation.valid) {
        return validation.value;
      }
    }
  }

  return null;
}

module.exports = {
  isPositiveNumber,
  validateNutritionValue,
  validateWeight,
  extractWeightFromText
};
