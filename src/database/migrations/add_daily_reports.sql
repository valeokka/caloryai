-- Миграция: добавление дневных отчетов

-- Таблица дневных отчетов
CREATE TABLE IF NOT EXISTS daily_reports (
  id SERIAL PRIMARY KEY,
  user_telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  target_calories INTEGER,
  target_protein INTEGER,
  target_fat INTEGER,
  target_carbs INTEGER,
  consumed_calories INTEGER DEFAULT 0,
  consumed_protein INTEGER DEFAULT 0,
  consumed_fat INTEGER DEFAULT 0,
  consumed_carbs INTEGER DEFAULT 0,
  meals_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_telegram_id, report_date)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON daily_reports(user_telegram_id, report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

-- Добавляем поле meal_time в requests_history для времени приема пищи
ALTER TABLE requests_history 
ADD COLUMN IF NOT EXISTS meal_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS meal_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Индекс для быстрого поиска приемов пищи за день
CREATE INDEX IF NOT EXISTS idx_requests_user_date ON requests_history(user_telegram_id, DATE(meal_time));

-- Комментарии
COMMENT ON TABLE daily_reports IS 'Дневные отчеты по питанию';
COMMENT ON COLUMN daily_reports.report_date IS 'Дата отчета';
COMMENT ON COLUMN daily_reports.target_calories IS 'Целевые калории на день';
COMMENT ON COLUMN daily_reports.consumed_calories IS 'Потребленные калории';
COMMENT ON COLUMN daily_reports.meals_count IS 'Количество приемов пищи';

COMMENT ON COLUMN requests_history.meal_time IS 'Время приема пищи';
COMMENT ON COLUMN requests_history.meal_name IS 'Название приема пищи (завтрак, обед, ужин, перекус)';
COMMENT ON COLUMN requests_history.is_deleted IS 'Помечен как удаленный';
