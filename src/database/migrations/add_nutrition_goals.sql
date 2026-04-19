-- Миграция: добавление целей и нутриентов в профиль

-- Добавляем новые поля в таблицу user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS goal_type VARCHAR(20) CHECK (goal_type IN ('deficit', 'maintenance', 'surplus')),
ADD COLUMN IF NOT EXISTS goal_mode VARCHAR(20) DEFAULT 'simple' CHECK (goal_mode IN ('simple', 'advanced')),
ADD COLUMN IF NOT EXISTS goal_percent DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS tdee INTEGER,
ADD COLUMN IF NOT EXISTS target_calories INTEGER,
ADD COLUMN IF NOT EXISTS protein_per_kg DECIMAL(3, 1),
ADD COLUMN IF NOT EXISTS fat_per_kg DECIMAL(3, 1),
ADD COLUMN IF NOT EXISTS protein_g INTEGER,
ADD COLUMN IF NOT EXISTS fat_g INTEGER,
ADD COLUMN IF NOT EXISTS carbs_g INTEGER;

-- Комментарии к новым полям
COMMENT ON COLUMN user_profiles.goal_type IS 'Тип цели: deficit (похудение), maintenance (поддержание), surplus (набор массы)';
COMMENT ON COLUMN user_profiles.goal_mode IS 'Режим настройки: simple (упрощенный), advanced (расширенный)';
COMMENT ON COLUMN user_profiles.goal_percent IS 'Процент от TDEE (-20 до +20)';
COMMENT ON COLUMN user_profiles.tdee IS 'Total Daily Energy Expenditure (суточная норма калорий)';
COMMENT ON COLUMN user_profiles.target_calories IS 'Целевые калории с учетом цели';
COMMENT ON COLUMN user_profiles.protein_per_kg IS 'Белок в граммах на кг веса';
COMMENT ON COLUMN user_profiles.fat_per_kg IS 'Жиры в граммах на кг веса';
COMMENT ON COLUMN user_profiles.protein_g IS 'Белок в граммах';
COMMENT ON COLUMN user_profiles.fat_g IS 'Жиры в граммах';
COMMENT ON COLUMN user_profiles.carbs_g IS 'Углеводы в граммах';

-- Обновляем существующие записи (если есть)
-- Устанавливаем дефолтные значения для существующих профилей
UPDATE user_profiles 
SET 
  goal_type = 'maintenance',
  goal_mode = 'simple',
  goal_percent = 0,
  tdee = calorie_goal,
  target_calories = calorie_goal,
  protein_per_kg = 1.6,
  fat_per_kg = 0.9
WHERE goal_type IS NULL;
