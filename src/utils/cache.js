/**
 * Простой in-memory кэш для БД запросов
 */

const logger = require('./logger');
const { CACHE } = require('../config/constants');

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.enabled = CACHE.DB_CACHE_ENABLED;
    this.ttl = CACHE.DB_CACHE_TTL_MS;
    
    // Периодическая очистка устаревших записей
    if (this.enabled) {
      this.cleanupInterval = setInterval(() => {
        this._cleanup();
      }, this.ttl);
      
      logger.info('DB cache initialized', { 
        enabled: this.enabled, 
        ttl: `${this.ttl}ms` 
      });
    }
  }

  /**
   * Получить значение из кэша
   * @param {string} key - Ключ
   * @returns {any|null} Значение или null если не найдено/устарело
   */
  get(key) {
    if (!this.enabled) return null;

    const item = this.cache.get(key);
    if (!item) return null;

    // Проверяем, не устарело ли значение
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Сохранить значение в кэш
   * @param {string} key - Ключ
   * @param {any} value - Значение
   * @param {number} ttl - Время жизни в мс (опционально)
   */
  set(key, value, ttl = null) {
    if (!this.enabled) return;

    const expiresAt = Date.now() + (ttl || this.ttl);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Удалить значение из кэша
   * @param {string} key - Ключ
   */
  delete(key) {
    if (!this.enabled) return;
    this.cache.delete(key);
  }

  /**
   * Удалить все значения с определенным префиксом
   * @param {string} prefix - Префикс ключа
   */
  deleteByPrefix(prefix) {
    if (!this.enabled) return;

    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    if (!this.enabled) return;
    
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { previousSize: size });
  }

  /**
   * Получить статистику кэша
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      enabled: this.enabled,
      size: this.cache.size,
      ttl: this.ttl
    };
  }

  /**
   * Очистка устаревших записей
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    // Логируем только если очистили много записей
    if (cleaned > 10) {
      logger.info('Cache cleanup completed', { 
        cleaned, 
        remaining: this.cache.size 
      });
    }
  }

  /**
   * Остановить кэш (для graceful shutdown)
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Cache stopped');
    }
  }
}

// Создаем singleton
const cache = new SimpleCache();

// Graceful shutdown
process.on('SIGINT', () => cache.stop());
process.on('SIGTERM', () => cache.stop());

module.exports = cache;
