#!/usr/bin/env node

/**
 * Скрипт для запуска миграций базы данных
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

/**
 * Конфигурация подключения к базе данных
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'calorie_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
};

/**
 * Проверка наличия обязательных переменных окружения
 */
function validateEnvironment() {
  const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Отсутствуют обязательные переменные окружения:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nПроверьте файл .env');
    process.exit(1);
  }
}

/**
 * Проверка подключения к базе данных
 */
async function testConnection(pool) {
  try {
    console.log('🔍 Проверка подключения к базе данных...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Подключение к базе данных успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

/**
 * Выполнение миграции
 */
async function runMigration() {
  console.log('🚀 Запуск миграции базы данных...\n');
  
  // Проверяем переменные окружения
  validateEnvironment();
  
  // Создаем пул подключений
  const pool = new Pool(dbConfig);
  
  try {
    // Проверяем подключение
    const connectionOk = await testConnection(pool);
    if (!connectionOk) {
      process.exit(1);
    }
    
    // Читаем файлы миграций
    const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
    const migrationFiles = [
      'init.sql',
      'add_user_profiles.sql',
      'add_nutrition_goals.sql'
    ];
    
    console.log('📄 Чтение файлов миграций...');
    
    // Выполняем миграции в транзакции
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const fileName of migrationFiles) {
        const migrationPath = path.join(migrationsDir, fileName);
        
        if (!fs.existsSync(migrationPath)) {
          console.warn(`⚠️  Файл миграции не найден: ${fileName} (пропускаем)`);
          continue;
        }
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        if (!migrationSQL.trim()) {
          console.warn(`⚠️  Файл миграции пуст: ${fileName} (пропускаем)`);
          continue;
        }
        
        console.log(`⚡ Выполнение миграции: ${fileName}...`);
        await client.query(migrationSQL);
        console.log(`   ✓ ${fileName}`);
      }
      
      await client.query('COMMIT');
      
      console.log('✅ Все миграции выполнены успешно');
      
      // Проверяем созданные таблицы
      console.log('\n📊 Проверка созданных таблиц:');
      
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      
      const result = await client.query(tablesQuery);
      
      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          console.log(`   ✓ ${row.table_name}`);
        });
      } else {
        console.log('   ⚠️  Таблицы не найдены');
      }
      
      // Проверяем начальные данные
      console.log('\n👥 Проверка классов пользователей:');
      const classesResult = await client.query('SELECT class_name, daily_limit FROM user_classes ORDER BY id;');
      
      if (classesResult.rows.length > 0) {
        classesResult.rows.forEach(row => {
          const limit = row.daily_limit === null ? 'безлимит' : row.daily_limit;
          console.log(`   ✓ ${row.class_name} (лимит: ${limit})`);
        });
      } else {
        console.log('   ⚠️  Классы пользователей не найдены');
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении миграции:');
    console.error(`   ${error.message}`);
    
    if (error.code) {
      console.error(`   Код ошибки: ${error.code}`);
    }
    
    if (error.detail) {
      console.error(`   Детали: ${error.detail}`);
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  console.log('\n🎉 Миграция завершена успешно!');
}

/**
 * Показать справку
 */
function showHelp() {
  console.log(`
Скрипт для запуска миграций базы данных

Использование:
  node scripts/migrate.js

Переменные окружения:
  DB_HOST      - Хост базы данных (по умолчанию: localhost)
  DB_PORT      - Порт базы данных (по умолчанию: 5432)
  DB_NAME      - Имя базы данных (обязательно)
  DB_USER      - Пользователь базы данных (обязательно)
  DB_PASSWORD  - Пароль базы данных (обязательно)

Примеры:
  npm run migrate
  node scripts/migrate.js
  `);
}

// Обработка аргументов командной строки
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанная ошибка:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});

// Запуск миграции
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };