# Calorie Counter Bot

Телеграм-бот для подсчета калорий по фотографиям еды с использованием ChatGPT Vision API.

## Возможности

- 🍽️ Анализ калорийности и макронутриентов по фото еды
- 📊 Система классов пользователей (FREE, PREMIUM, ADMIN)
- 💰 Покупка дополнительных запросов через Telegram Payments
- ✏️ Корректировка результатов анализа
- 📈 Отслеживание статистики использования

## Требования

- Node.js v18+
- PostgreSQL v14+
- PM2 (для продакшена)

## Установка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd calorie-counter-bot
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните необходимые значения:

```bash
cp .env.example .env
```

### 4. Настройка базы данных

Создайте базу данных PostgreSQL и выполните миграцию:

```bash
# Создание базы данных (выполните в psql)
CREATE DATABASE calorie_bot;

# Выполнение миграции
npm run migrate
```

## Переменные окружения

```env
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=calorie_bot
DB_USER=postgres
DB_PASSWORD=your_password

# Telegram Payments (опционально)
PAYMENT_PROVIDER_TOKEN=your_payment_token

# Application
NODE_ENV=production
LOG_LEVEL=info
```

### Получение токенов

#### Telegram Bot Token
1. Найдите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен

#### OpenAI API Key
1. Зарегистрируйтесь на [OpenAI Platform](https://platform.openai.com/)
2. Перейдите в раздел API Keys
3. Создайте новый API ключ
4. Скопируйте ключ

#### Payment Provider Token (для платежей)
1. Обратитесь к @BotFather
2. Отправьте `/mybots`
3. Выберите вашего бота → Payments
4. Выберите провайдера платежей
5. Скопируйте токен

## Запуск

### Режим разработки

```bash
npm run dev
```

### Продакшен

```bash
# Запуск с PM2
npm start

# Или напрямую
npm run prod
```

## Управление ботом

### PM2 команды

```bash
# Просмотр статуса
pm2 status

# Просмотр логов
npm run logs
# или
pm2 logs calorie-bot

# Перезапуск
pm2 restart calorie-bot

# Остановка
pm2 stop calorie-bot

# Удаление из PM2
pm2 delete calorie-bot

# Мониторинг
pm2 monit
```

### Миграции базы данных

```bash
# Выполнение миграции
npm run migrate
```

## Структура проекта

```
calorie-counter-bot/
├── src/
│   ├── bot/                    # Telegram bot логика
│   │   ├── index.js           # Инициализация бота
│   │   ├── handlers/          # Обработчики команд и событий
│   │   └── middleware/        # Middleware для бота
│   ├── services/              # Бизнес-логика
│   ├── database/              # Работа с БД
│   ├── utils/                 # Утилиты
│   └── config/                # Конфигурация
├── scripts/                   # Скрипты
├── logs/                      # Логи (создается автоматически)
├── ecosystem.config.js        # Конфигурация PM2
├── .env.example              # Пример переменных окружения
└── README.md
```

## Команды бота

- `/start` - Начать работу с ботом
- `/status` - Показать статистику использования
- Отправка фото - Анализ калорийности еды

## Классы пользователей

### FREE
- 1 бесплатный запрос в день
- Возможность покупки дополнительных запросов

### PREMIUM
- Безлимитные запросы
- Все функции бота

### ADMIN
- Безлимитные запросы
- Административные функции

## Пакеты запросов

- 10 запросов - 99 ₽
- 50 запросов - 399 ₽
- 100 запросов - 699 ₽

## Логирование

Логи сохраняются в директории `logs/`:
- `error.log` - только ошибки
- `combined.log` - все логи
- `out.log` - stdout от PM2
- `err.log` - stderr от PM2

## Мониторинг

### Проверка работоспособности

```bash
# Проверка статуса бота
pm2 status calorie-bot

# Просмотр последних логов
pm2 logs calorie-bot --lines 50

# Мониторинг ресурсов
pm2 monit
```

### Основные метрики

- Использование памяти (лимит: 1GB)
- Количество перезапусков
- Время работы (uptime)
- Ошибки в логах

## Устранение неполадок

### Бот не отвечает

1. Проверьте статус: `pm2 status`
2. Проверьте логи: `pm2 logs calorie-bot`
3. Проверьте переменные окружения
4. Проверьте подключение к БД

### Ошибки OpenAI API

1. Проверьте валидность API ключа
2. Проверьте баланс аккаунта OpenAI
3. Проверьте лимиты запросов

### Ошибки базы данных

1. Проверьте подключение к PostgreSQL
2. Убедитесь, что миграции выполнены
3. Проверьте права доступа пользователя БД

## Разработка

### Добавление новых функций

1. Обновите требования в `.kiro/specs/calorie-counter-bot/requirements.md`
2. Обновите дизайн в `.kiro/specs/calorie-counter-bot/design.md`
3. Добавьте задачи в `.kiro/specs/calorie-counter-bot/tasks.md`
4. Реализуйте функционал
5. Обновите документацию

### Тестирование

```bash
# Запуск в режиме разработки
npm run dev

# Проверка логов
tail -f logs/combined.log
```

## Лицензия

MIT License

## Поддержка

Для получения поддержки создайте issue в репозитории или обратитесь к разработчикам.