const { Pool } = require('pg');
const logger = require('../utils/logger');
const { DATABASE } = require('../config/constants');

// Создаем оптимизированный пул подключений
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Размер пула
  max: DATABASE.MAX_CONNECTIONS,  // максимум соединений
  min: DATABASE.MIN_CONNECTIONS,  // минимум активных соединений
  
  // Таймауты
  idleTimeoutMillis: DATABASE.IDLE_TIMEOUT,  // время до закрытия idle соединения
  connectionTimeoutMillis: DATABASE.CONNECTION_TIMEOUT,  // таймаут на подключение
  statement_timeout: DATABASE.STATEMENT_TIMEOUT,  // таймаут на выполнение запроса
  
  // Дополнительные оптимизации
  allowExitOnIdle: false,  // не завершать процесс при idle
  maxUses: 7500,  // максимум использований одного соединения перед пересозданием
  
  // Настройки PostgreSQL
  application_name: 'calorie-bot',  // имя приложения в pg_stat_activity
});

// Обработка ошибок подключения
pool.on('error', (err, client) => {
  logger.error('Unexpected database error', { 
    error: err.message, 
    stack: err.stack,
    clientInfo: client ? 'Client exists' : 'No client'
  });
});

// Логирование подключения нового клиента (только в dev режиме)
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', (client) => {
    logger.debug('New database client connected', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });
  });

  pool.on('acquire', (client) => {
    logger.debug('Client acquired from pool', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });
  });

  pool.on('remove', (client) => {
    logger.debug('Client removed from pool', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
});

process.on('SIGTERM', async () => {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
});

// Функция для получения статистики пула
function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
}

module.exports = pool;
module.exports.getPoolStats = getPoolStats;
