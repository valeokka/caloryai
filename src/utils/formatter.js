/**
 * Модуль форматирования сообщений для пользователей
 */

/**
 * Форматирует число с округлением до 1 десятичного знака
 * @param {number} value - Число для форматирования
 * @returns {string} - Отформатированное число
 */
function formatNumber(value) {
  if (value === null || value === undefined) {
    return '0.0';
  }
  return Number(value).toFixed(1);
}

/**
 * Форматирует данные о пищевой ценности для отображения пользователю
 * @param {Object} nutritionData - Данные о пищевой ценности
 * @param {string} nutritionData.dishName - Название блюда
 * @param {number} nutritionData.calories - Калории
 * @param {number} nutritionData.protein - Белки
 * @param {number} nutritionData.fat - Жиры
 * @param {number} nutritionData.carbs - Углеводы
 * @param {number} [nutritionData.weight] - Вес порции (опционально)
 * @returns {string} - Отформатированное сообщение
 */
function formatNutritionData(nutritionData) {
  const { dishName, calories, protein, fat, carbs, weight } = nutritionData;

  let message = `🍽️ <b>${dishName}</b>\n\n`;

  if (weight) {
    message += `⚖️ Вес порции: ${weight}г\n\n`;
  }

  message += `🔥 Калории: <b>${formatNumber(calories)}</b> ккал\n`;
  message += `🥩 Белки: <b>${formatNumber(protein)}</b> г\n`;
  message += `🧈 Жиры: <b>${formatNumber(fat)}</b> г\n`;
  message += `🍞 Углеводы: <b>${formatNumber(carbs)}</b> г`;

  return message;
}

/**
 * Форматирует статистику пользователя
 * @param {Object} stats - Статистика пользователя
 * @param {string} stats.className - Название класса пользователя
 * @param {number|null} stats.dailyLimit - Дневной лимит (null = безлимит)
 * @param {number} stats.usedToday - Использовано запросов сегодня
 * @param {number} stats.purchasedRequests - Купленные запросы
 * @returns {string} - Отформатированное сообщение
 */
function formatUserStats(stats) {
  const { className, dailyLimit, usedToday, purchasedRequests } = stats;

  let message = `📊 <b>Твоя статистика</b>\n\n`;
  message += `👤 Класс: <b>${className}</b>\n\n`;

  if (dailyLimit === null) {
    // Безлимитный доступ (PREMIUM/ADMIN)
    message += `✨ У тебя безлимитный доступ!\n`;
    message += `📈 Использовано сегодня: ${usedToday} запросов\n`;
  } else {
    // FREE пользователь с лимитами
    const remaining = Math.max(0, dailyLimit - usedToday);
    message += `📅 Дневной лимит: ${dailyLimit} запросов\n`;
    message += `✅ Использовано сегодня: ${usedToday}\n`;
    message += `⏳ Осталось сегодня: ${remaining}\n`;
  }

  if (purchasedRequests > 0) {
    message += `\n💎 Купленные запросы: <b>${purchasedRequests}</b>`;
  }

  return message;
}

/**
 * Форматирует сообщение об ошибке для пользователя
 * @param {string} errorMessage - Сообщение об ошибке
 * @returns {string} - Отформатированное сообщение
 */
function formatError(errorMessage) {
  return `⚠️ ${errorMessage}`;
}

/**
 * Форматирует сообщение об успешной операции
 * @param {string} successMessage - Сообщение об успехе
 * @returns {string} - Отформатированное сообщение
 */
function formatSuccess(successMessage) {
  return `✅ ${successMessage}`;
}

/**
 * Форматирует список пакетов оплаты
 * @param {Array} packages - Массив пакетов оплаты
 * @returns {string} - Отформатированное сообщение
 */
function formatPaymentPackages(packages) {
  let message = `💳 <b>Купить дополнительные запросы</b>\n\n`;
  message += `Выбери подходящий пакет:\n\n`;

  packages.forEach((pkg, index) => {
    message += `${index + 1}. <b>${pkg.requests} запросов</b> - ${pkg.price} ${pkg.currency}\n`;
  });

  return message;
}

module.exports = {
  formatNumber,
  formatNutritionData,
  formatUserStats,
  formatError,
  formatSuccess,
  formatPaymentPackages
};
