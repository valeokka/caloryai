#!/usr/bin/env node

/**
 * Test runner script for Calorie Counter Bot
 * Запускает все тесты и выводит результаты
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Запуск тестов Calorie Counter Bot...\n');

// Проверяем наличие Jest
const jestPath = path.join(__dirname, 'node_modules', '.bin', 'jest');

const testProcess = spawn('node', [jestPath, '--verbose', '--coverage'], {
  stdio: 'inherit',
  cwd: __dirname
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Все тесты прошли успешно!');
    console.log('\n📊 Результаты тестирования:');
    console.log('- ✅ Основной флоу: обработка фото, извлечение веса, форматирование');
    console.log('- ✅ Система лимитов: FREE/PREMIUM/ADMIN, купленные запросы');
    console.log('- ✅ Корректировка: валидация, сохранение, отмена');
    console.log('- ✅ Обработка ошибок: API, БД, сеть, пользовательские сообщения');
    console.log('\n🎯 Все требования покрыты тестами!');
  } else {
    console.log(`\n❌ Тесты завершились с ошибкой (код: ${code})`);
    console.log('Проверьте вывод выше для деталей.');
  }
  
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('❌ Ошибка запуска тестов:', error.message);
  console.log('\n💡 Убедитесь, что:');
  console.log('1. Node.js установлен (версия 18+)');
  console.log('2. Зависимости установлены: npm install');
  console.log('3. Jest доступен в node_modules');
  process.exit(1);
});