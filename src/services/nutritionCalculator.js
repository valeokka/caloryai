/**
 * Сервис для расчета целевых калорий и нутриентов (БЖУ)
 */

const logger = require('../utils/logger');

/**
 * Предустановленные проценты для упрощенного режима
 */
const SIMPLE_MODE_PRESETS = [
  { percent: -20, label: '-20%' },
  { percent: -15, label: '-15%' },
  { percent: -10, label: '-10%' },
  { percent: 0, label: '0%' },
  { percent: 10, label: '+10%' },
  { percent: 15, label: '+15%' },
  { percent: 20, label: '+20%' }
];

/**
 * Дефолтные значения БЖУ в зависимости от цели
 */
const DEFAULT_MACROS = {
  deficit: {
    protein_per_kg: 2.0,
    fat_per_kg: 0.8
  },
  maintenance: {
    protein_per_kg: 1.6,
    fat_per_kg: 0.9
  },
  surplus: {
    protein_per_kg: 1.7,
    fat_per_kg: 1.0
  }
};

/**
 * Минимальные калории
 */
const MIN_CALORIES = {
  male: 1500,
  female: 1200
};

/**
 * Калорийность макронутриентов (ккал/г)
 */
const CALORIES_PER_GRAM = {
  protein: 4,
  fat: 9,
  carbs: 4
};

class NutritionCalculator {
  /**
   * Получить предустановки для упрощенного режима
   */
  getSimpleModePresets() {
    return SIMPLE_MODE_PRESETS;
  }

  /**
   * Определить тип цели по проценту
   */
  getGoalType(percent) {
    if (percent < 0) return 'deficit';
    if (percent > 0) return 'surplus';
    return 'maintenance';
  }

  /**
   * Получить дефолтные макросы для цели
   */
  getDefaultMacros(goalType) {
    return DEFAULT_MACROS[goalType] || DEFAULT_MACROS.maintenance;
  }

  /**
   * Рассчитать целевые калории от TDEE
   */
  calculateTargetCalories(tdee, percent) {
    const targetCalories = Math.round(tdee * (1 + percent / 100));
    logger.info('Target calories calculated', { tdee, percent, targetCalories });
    return targetCalories;
  }

  /**
   * Рассчитать макронутриенты (БЖУ)
   */
  calculateMacros(targetCalories, weight, proteinPerKg, fatPerKg) {
    // Белок
    const proteinG = Math.round(weight * proteinPerKg);
    const proteinKcal = proteinG * CALORIES_PER_GRAM.protein;

    // Жиры
    const fatG = Math.round(weight * fatPerKg);
    const fatKcal = fatG * CALORIES_PER_GRAM.fat;

    // Углеводы (остаток калорий)
    const carbsKcal = targetCalories - proteinKcal - fatKcal;
    const carbsG = Math.round(carbsKcal / CALORIES_PER_GRAM.carbs);

    logger.info('Macros calculated', {
      targetCalories,
      weight,
      proteinPerKg,
      fatPerKg,
      proteinG,
      fatG,
      carbsG
    });

    return {
      protein_g: proteinG,
      fat_g: fatG,
      carbs_g: Math.max(0, carbsG) // не может быть отрицательным
    };
  }

  /**
   * Валидация целевых калорий
   */
  validateTargetCalories(targetCalories, bmr, gender) {
    const minCalories = MIN_CALORIES[gender] || MIN_CALORIES.male;

    if (targetCalories < bmr) {
      logger.warn('Target calories below BMR', { targetCalories, bmr });
      return { valid: false, reason: `Калории не могут быть ниже BMR (${bmr} ккал)` };
    }

    if (targetCalories < minCalories) {
      logger.warn('Target calories below minimum', { targetCalories, minCalories, gender });
      return { valid: false, reason: `Минимум для ${gender === 'female' ? 'женщин' : 'мужчин'}: ${minCalories} ккал` };
    }

    return { valid: true };
  }

  /**
   * Полный расчет питания (упрощенный режим)
   */
  calculateSimpleMode({ tdee, bmr, gender, weight, percent }) {
    try {
      // Определяем тип цели
      const goalType = this.getGoalType(percent);

      // Рассчитываем целевые калории
      const targetCalories = this.calculateTargetCalories(tdee, percent);

      // Валидация
      const validation = this.validateTargetCalories(targetCalories, bmr, gender);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Получаем дефолтные макросы для цели
      const defaultMacros = this.getDefaultMacros(goalType);

      // Рассчитываем БЖУ
      const macros = this.calculateMacros(
        targetCalories,
        weight,
        defaultMacros.protein_per_kg,
        defaultMacros.fat_per_kg
      );

      return {
        goal_type: goalType,
        goal_mode: 'simple',
        goal_percent: percent,
        tdee,
        target_calories: targetCalories,
        protein_per_kg: defaultMacros.protein_per_kg,
        fat_per_kg: defaultMacros.fat_per_kg,
        ...macros
      };
    } catch (error) {
      logger.error('Error in calculateSimpleMode', { error: error.message });
      throw error;
    }
  }

  /**
   * Полный расчет питания (расширенный режим)
   */
  calculateAdvancedMode({ tdee, bmr, gender, weight, calories, percent, proteinPerKg, fatPerKg }) {
    try {
      // Приоритет: калории > процент
      let targetCalories;
      let goalPercent;

      if (calories) {
        // Калории заданы напрямую
        targetCalories = calories;
        goalPercent = Math.round(((calories / tdee) - 1) * 100);
      } else if (percent !== undefined) {
        // Процент задан
        targetCalories = this.calculateTargetCalories(tdee, percent);
        goalPercent = percent;
      } else {
        throw new Error('Необходимо указать калории или процент');
      }

      // Валидация
      const validation = this.validateTargetCalories(targetCalories, bmr, gender);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Определяем тип цели
      const goalType = this.getGoalType(goalPercent);

      // Если макросы не заданы, используем дефолтные
      const defaultMacros = this.getDefaultMacros(goalType);
      const finalProteinPerKg = proteinPerKg || defaultMacros.protein_per_kg;
      const finalFatPerKg = fatPerKg || defaultMacros.fat_per_kg;

      // Рассчитываем БЖУ
      const macros = this.calculateMacros(
        targetCalories,
        weight,
        finalProteinPerKg,
        finalFatPerKg
      );

      return {
        goal_type: goalType,
        goal_mode: 'advanced',
        goal_percent: goalPercent,
        tdee,
        target_calories: targetCalories,
        protein_per_kg: finalProteinPerKg,
        fat_per_kg: finalFatPerKg,
        ...macros
      };
    } catch (error) {
      logger.error('Error in calculateAdvancedMode', { error: error.message });
      throw error;
    }
  }

  /**
   * Валидация входных данных
   */
  validateInput({ weight, proteinPerKg, fatPerKg, percent, calories }) {
    if (weight <= 0 || weight > 500) {
      throw new Error('Вес должен быть от 1 до 500 кг');
    }

    if (proteinPerKg !== undefined && (proteinPerKg < 0.5 || proteinPerKg > 5)) {
      throw new Error('Белок должен быть от 0.5 до 5 г/кг');
    }

    if (fatPerKg !== undefined && (fatPerKg < 0.3 || fatPerKg > 3)) {
      throw new Error('Жиры должны быть от 0.3 до 3 г/кг');
    }

    if (percent !== undefined && (percent < -50 || percent > 50)) {
      throw new Error('Процент должен быть от -50% до +50%');
    }

    if (calories !== undefined && (calories < 500 || calories > 10000)) {
      throw new Error('Калории должны быть от 500 до 10000 ккал');
    }
  }

  /**
   * Получить название цели на русском
   */
  getGoalName(goalType) {
    const names = {
      deficit: '🔻 Похудение',
      maintenance: '⚖️ Поддержание',
      surplus: '🔺 Набор массы'
    };
    return names[goalType] || goalType;
  }
}

module.exports = new NutritionCalculator();
