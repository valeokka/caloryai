/**
 * Константы приложения
 */

module.exports = {
  // Классы пользователей
  USER_CLASSES: {
    FREE: 1,
    PREMIUM: 2,
    ADMIN: 3
  },

  // Пакеты оплаты (Telegram Stars, валюта XTR)
  PAYMENT_PACKAGES: [
    {
      requests: 10,
      price: 25,
      currency: 'XTR',
      title: '10 запросов',
      description: 'Пакет из 10 дополнительных запросов'
    },
    {
      requests: 50,
      price: 100,
      currency: 'XTR',
      title: '50 запросов',
      description: 'Пакет из 50 дополнительных запросов'
    },
    {
      requests: 100,
      price: 175,
      currency: 'XTR',
      title: '100 запросов',
      description: 'Пакет из 100 дополнительных запросов'
    }
  ],

  // Настройки OpenAI
  OPENAI: {
    TIMEOUT: parseInt(process.env.OPENAI_TIMEOUT) || 30000, // 30 секунд
    MAX_RETRIES: parseInt(process.env.OPENAI_MAX_RETRIES) || 2,
    MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',  // gpt-4o-mini в 15 раз дешевле gpt-4o!
    MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS) || 100  // минимум для JSON ответа
  },

  // Настройки базы данных
  DATABASE: {
    MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    MIN_CONNECTIONS: parseInt(process.env.DB_MIN_CONNECTIONS) || 2,  // минимум активных соединений
    IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 секунд
    CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000, // 2 секунды
    STATEMENT_TIMEOUT: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 10000, // 10 секунд
    ACQUIRE_TIMEOUT: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000, // 60 секунд на получение соединения
    EVICTION_RUN_INTERVAL: parseInt(process.env.DB_EVICTION_INTERVAL) || 10000 // проверка idle соединений каждые 10 сек
  },

  // Лимиты и валидация
  VALIDATION: {
    WEIGHT: {
      MIN: parseInt(process.env.WEIGHT_MIN) || 10,        // минимальный вес порции в граммах
      MAX: parseInt(process.env.WEIGHT_MAX) || 5000,      // максимальный вес порции в граммах
      ABSOLUTE_MAX: parseInt(process.env.WEIGHT_ABSOLUTE_MAX) || 10000  // абсолютный максимум для валидации
    },
    NUTRITION: {
      MAX_CALORIES: parseInt(process.env.MAX_CALORIES) || 10000,
      MAX_PROTEIN: parseInt(process.env.MAX_PROTEIN) || 1000,
      MAX_FAT: parseInt(process.env.MAX_FAT) || 1000,
      MAX_CARBS: parseInt(process.env.MAX_CARBS) || 1000,
      DECIMAL_PLACES: 1  // количество знаков после запятой
    },
    PHOTO: {
      MAX_SIZE_MB: parseInt(process.env.MAX_PHOTO_SIZE_MB) || 5,  // максимальный размер фото в МБ
      MAX_SIZE_BYTES: (parseInt(process.env.MAX_PHOTO_SIZE_MB) || 5) * 1024 * 1024
    }
  },

  // Калорийность макронутриентов
  CALORIES_PER_GRAM: {
    PROTEIN: 4,  // 1г белка = 4 ккал
    FAT: 9,      // 1г жира = 9 ккал
    CARBS: 4     // 1г углеводов = 4 ккал
  },

  // Настройки кэширования
  CACHE: {
    ENABLED: process.env.CACHE_ENABLED !== 'false',  // по умолчанию включено
    TTL_HOURS: parseInt(process.env.CACHE_TTL_HOURS) || 24,  // время жизни кэша в часах
    // Кэширование запросов к БД в памяти
    DB_CACHE_ENABLED: process.env.DB_CACHE_ENABLED !== 'false',
    DB_CACHE_TTL_MS: parseInt(process.env.DB_CACHE_TTL_MS) || 60000  // 1 минута
  },

  // Настройки сжатия изображений
  IMAGE: {
    COMPRESSION_ENABLED: process.env.IMAGE_COMPRESSION_ENABLED !== 'false',
    MAX_WIDTH: parseInt(process.env.IMAGE_MAX_WIDTH) || 1920,  // максимальная ширина
    MAX_HEIGHT: parseInt(process.env.IMAGE_MAX_HEIGHT) || 1920,  // максимальная высота
    QUALITY: parseInt(process.env.IMAGE_QUALITY) || 85,  // качество JPEG (0-100)
    FORMAT: process.env.IMAGE_FORMAT || 'jpeg'  // формат вывода
  },

  // Сообщения для пользователей
  MESSAGES: {
    WELCOME: '👋 Привет! Я помогу тебе подсчитать калории и макронутриенты по фото еды.\n\n' +
             '📸 Просто отправь мне фотографию блюда\n' +
             '⚖️ Можешь указать вес порции в подписи к фото (например: "250")\n\n' +
             'Доступные команды:\n' +
             '/diary - дневник питания с отчетом за день\n' +
             '/profile - управление профилем и расчет нормы калорий (опционально)\n' +
             '/status - проверить статус и лимиты\n' +
             '/buy - купить дополнительные запросы\n' +
             '/start - показать это сообщение\n\n' +
             '💡 Профиль не обязателен - можешь сразу отправлять фото еды!',
    
    PROCESSING: '⏳ Анализирую фото...',
    
    LIMIT_REACHED: '⚠️ Дневной лимит запросов исчерпан.\n\n' +
                   'У тебя закончились бесплатные запросы на сегодня. ' +
                   'Купи дополнительные запросы, чтобы продолжить использование бота.',
    
    NO_PURCHASED_REQUESTS: '⚠️ У тебя закончились купленные запросы.\n\n' +
                           'Купи дополнительные запросы, чтобы продолжить.',
    
    ERROR: '⚠️ Произошла ошибка при обработке запроса. Попробуй позже.',
    
    API_ERROR: '⚠️ Сервис анализа временно недоступен. Попробуй позже.',
    
    DB_ERROR: '⚠️ Ошибка сохранения данных. Попробуй позже.',
    
    INVALID_INPUT: '⚠️ Некорректный ввод. Пожалуйста, введи положительное число.',
    
    INVALID_WEIGHT: '⚠️ Указан некорректный вес порции. Буду определять вес автоматически.',
    
    PHOTO_TOO_LARGE: '⚠️ Размер фото слишком большой. Максимальный размер: {maxSize}МБ.\nПопробуй сжать фото или отправить другое.',
    
    CACHED_RESULT: '♻️ Это фото уже анализировалось ранее. Вот сохраненный результат:',
    
    CORRECTION_PROMPT: 'Введи новое значение:',
    
    CORRECTION_SUCCESS: '✅ Данные обновлены',
    
    PAYMENT_SUCCESS: '✅ Оплата прошла успешно! Запросы добавлены на твой счет.',
    
    PAYMENT_CANCELLED: '❌ Оплата отменена.'
  }
};
