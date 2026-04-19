/**
 * Утилиты для расчёта пищевой ценности
 */

const { CALORIES_PER_GRAM } = require('../config/constants');

/**
 * Рассчитать калорийность на основе БЖУ
 * @param {number} protein - Белки в граммах
 * @param {number} fat - Жиры в граммах
 * @param {number} carbs - Углеводы в граммах
 * @returns {number} Калорийность в ккал
 */
function calculateCalories(protein, fat, carbs) {
  const proteinCalories = protein * CALORIES_PER_GRAM.PROTEIN;
  const fatCalories = fat * CALORIES_PER_GRAM.FAT;
  const carbsCalories = carbs * CALORIES_PER_GRAM.CARBS;
  
  return proteinCalories + fatCalories + carbsCalories;
}

/**
 * Пересчитать все значения при изменении веса
 * @param {Object} currentData - Текущие данные
 * @param {number} newWeight - Новый вес
 * @returns {Object} Пересчитанные данные
 */
function recalculateByWeight(currentData, newWeight) {
  const oldWeight = currentData.weight || 100;
  const ratio = newWeight / oldWeight;

  const protein = currentData.protein * ratio;
  const fat = currentData.fat * ratio;
  const carbs = currentData.carbs * ratio;
  const calories = calculateCalories(protein, fat, carbs);

  return {
    weight: newWeight,
    protein,
    fat,
    carbs,
    calories
  };
}

module.exports = {
  calculateCalories,
  recalculateByWeight
};
