/**
 * Модуль логирования с использованием Winston
 */

const winston = require('winston');
const path = require('path');

// Определяем уровень логирования из переменных окружения
const logLevel = process.env.LOG_LEVEL || 'info';

// Формат для файлов (JSON с timestamp)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Формат для консоли (colorize с timestamp)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Создаем директорию для логов, если её нет
const logsDir = path.join(process.cwd(), 'logs');

// Настройка транспортов
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: logLevel
  }),
  
  // File transport для всех логов
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: fileFormat,
    level: logLevel,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // File transport только для ошибок
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    format: fileFormat,
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Создаем logger
const logger = winston.createLogger({
  level: logLevel,
  transports,
  exitOnError: false
});

// Обработка необработанных исключений и отклонений промисов
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: fileFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: fileFormat
  })
);

module.exports = logger;
