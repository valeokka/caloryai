-- Инициализация схемы базы данных для Calorie Counter Bot

-- Таблица классов пользователей
CREATE TABLE IF NOT EXISTS user_classes (
  id SERIAL PRIMARY KEY,
  class_name VARCHAR(50) UNIQUE NOT NULL,
  daily_limit INTEGER,  -- NULL означает безлимит
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Начальные данные для классов пользователей
INSERT INTO user_classes (class_name, daily_limit, description) VALUES
  ('FREE', 1, 'Бесплатный класс с 1 запросом в день'),
  ('PREMIUM', NULL, 'Премиум подписка с безлимитными запросами'),
  ('ADMIN', NULL, 'Административный доступ')
ON CONFLICT (class_name) DO NOTHING;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  user_class_id INTEGER REFERENCES user_classes(id) DEFAULT 1,
  purchased_requests INTEGER DEFAULT 0,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_request_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по классу
CREATE INDEX IF NOT EXISTS idx_users_class ON users(user_class_id);

-- Таблица истории запросов
CREATE TABLE IF NOT EXISTS requests_history (
  id SERIAL PRIMARY KEY,
  user_telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  photo_file_id VARCHAR(255) NOT NULL,
  dish_name VARCHAR(255),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  fat DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  weight INTEGER,  -- вес порции в граммах
  is_corrected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_requests_user_date ON requests_history(user_telegram_id, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests_history(created_at);

-- Таблица транзакций
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_telegram_id BIGINT REFERENCES users(telegram_id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  requests_purchased INTEGER NOT NULL,
  payment_provider VARCHAR(50),
  payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для поиска транзакций пользователя
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_telegram_id);
