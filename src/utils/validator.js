/**
 * Модуль валидации данных
 */

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
    'Калории': 10000,
    'Белки': 1000,
    'Жиры': 1000,
    'Углеводы': 1000
  };

  const maxValue = maxValues[fieldName] || 10000;
  if (num > maxValue) {
    return {
      valid: false,
      error: `${fieldName} не может превышать ${maxValue}`,
      value: null
    };
  }

  // Округляем до 1 десятичного знака
  const roundedValue = Math.round(num * 10) / 10;

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

  if (num > 10000) {
    return {
      valid: false,
      error: 'Вес не может превышать 10000 грамм',
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
