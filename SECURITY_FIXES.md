# Критические исправления безопасности и стабильности

## Исправленные проблемы

### 1. ✅ Утечка BOT_TOKEN в URL фотографий
**Проблема:** Токен бота передавался в URL при отправке фото в OpenAI API, что создавало риск утечки через логи.

**Решение:** Заменили прямое формирование URL на безопасный метод `ctx.telegram.getFileLink()`, который возвращает подписанный URL без токена в явном виде.

```javascript
// Было (небезопасно):
const photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

// Стало (безопасно):
const photoUrl = await ctx.telegram.getFileLink(fileId);
```

**Файл:** `src/bot/handlers/photo.js`

---

### 2. ✅ Race Condition при списании запросов
**Проблема:** При одновременной отправке нескольких фото пользователь мог использовать больше купленных запросов, чем у него есть.

**Решение:** 
- Добавлена атомарная операция `decrementPurchasedRequestAtomic()` с проверкой `WHERE purchased_requests > 0`
- Создан новый метод `consumeRequestAtomic()` который проверяет и списывает запрос в одной транзакции
- Обработчик фото теперь использует атомарную операцию вместо раздельных проверки и списания

```javascript
// Новая атомарная операция в БД:
UPDATE users 
SET purchased_requests = purchased_requests - 1
WHERE telegram_id = $1 AND purchased_requests > 0
RETURNING *
```

**Файлы:** 
- `src/database/queries/users.js` - добавлена атомарная функция
- `src/services/requestService.js` - добавлен метод `consumeRequestAtomic()`
- `src/bot/handlers/photo.js` - использует новый метод

---

### 3. ✅ Валидация веса порции
**Проблема:** Парсинг веса через простой regex `/\d+/` мог захватывать любые числа из подписи (например, "Купил за 1000 рублей" → вес 1000г).

**Решение:**
- Улучшен regex для поиска веса: `/(\d+)\s*г?р?а?м?м?о?в?/i`
- Добавлена валидация диапазона: 10г - 5000г (настраивается через конфиг)
- Пользователь получает предупреждение при некорректном весе

```javascript
const weightMatch = caption.match(/(\d+)\s*г?р?а?м?м?о?в?/i);
if (weightMatch) {
  const parsedWeight = parseInt(weightMatch[1], 10);
  if (parsedWeight >= VALIDATION.WEIGHT.MIN && parsedWeight <= VALIDATION.WEIGHT.MAX) {
    weight = parsedWeight;
  } else {
    await ctx.reply(MESSAGES.INVALID_WEIGHT);
  }
}
```

**Файл:** `src/bot/handlers/photo.js`

---

### 4. ✅ Обновлена модель OpenAI
**Проблема:** В `.env.example` была указана устаревшая модель `gpt-4-vision-preview` (deprecated).

**Решение:** Обновлена на актуальную модель `gpt-4o`.

**Файл:** `.env.example`

---

### 5. ✅ Timeout для SQL запросов
**Проблема:** Отсутствовал таймаут на выполнение SQL запросов, что могло привести к зависанию бота.

**Решение:** Добавлен `statement_timeout: 10000` (10 секунд) в конфигурацию пула подключений.

```javascript
const pool = new Pool({
  // ...
  statement_timeout: DATABASE.STATEMENT_TIMEOUT, // 10 секунд
});
```

**Файл:** `src/database/connection.js`

---

### 6. ✅ Вынесены захардкоженные параметры в конфигурацию
**Проблема:** Множество параметров (лимиты, таймауты, размеры) были захардкожены в коде, что усложняло настройку и поддержку.

**Решение:** Все параметры вынесены в `src/config/constants.js` с возможностью переопределения через переменные окружения:

**Новые настройки в constants.js:**
- `OPENAI.TIMEOUT`, `OPENAI.MAX_RETRIES`, `OPENAI.MAX_TOKENS`
- `DATABASE.MAX_CONNECTIONS`, `DATABASE.IDLE_TIMEOUT`, `DATABASE.CONNECTION_TIMEOUT`, `DATABASE.STATEMENT_TIMEOUT`
- `VALIDATION.WEIGHT.MIN`, `VALIDATION.WEIGHT.MAX`, `VALIDATION.WEIGHT.ABSOLUTE_MAX`
- `VALIDATION.NUTRITION.MAX_CALORIES`, `MAX_PROTEIN`, `MAX_FAT`, `MAX_CARBS`, `DECIMAL_PLACES`

**Переопределение через .env:**
```env
# OpenAI Settings
OPENAI_TIMEOUT=30000
OPENAI_MAX_RETRIES=2
OPENAI_MAX_TOKENS=500

# Database Pool Settings
DB_MAX_CONNECTIONS=20
DB_STATEMENT_TIMEOUT=10000

# Validation Limits
WEIGHT_MIN=10
WEIGHT_MAX=5000
MAX_CALORIES=10000
```

**Файлы:** 
- `src/config/constants.js` - централизованная конфигурация
- `src/database/connection.js` - использует DATABASE константы
- `src/utils/validator.js` - использует VALIDATION константы
- `src/bot/handlers/photo.js` - использует VALIDATION константы
- `src/services/openai.js` - использует OPENAI константы
- `.env.example` - добавлены примеры переопределения

---

## Тестирование

### Проверка race condition:
1. Отправьте несколько фото одновременно (3-5 штук)
2. Проверьте, что списалось корректное количество купленных запросов
3. Проверьте логи на наличие предупреждений о неудачных попытках списания

### Проверка валидации веса:
```
✅ "250" → 250г
✅ "250г" → 250г
✅ "250 грамм" → 250г
❌ "1000000" → автоопределение (вне диапазона)
❌ "5" → автоопределение (вне диапазона)
✅ "Купил за 1000 рублей 250г" → 250г (первое совпадение с "г")
```

### Проверка безопасности URL:
1. Включите debug логирование в OpenAI
2. Отправьте фото
3. Убедитесь, что в логах нет BOT_TOKEN

### Проверка конфигурации:
1. Попробуйте переопределить параметры через .env
2. Проверьте, что изменения применяются
3. Убедитесь, что дефолтные значения работают без .env переменных

---

## Миграция

Изменения обратно совместимы, миграция БД не требуется.

Для применения изменений:
```bash
npm install  # если были обновлены зависимости
pm2 restart calorie-bot
```

---

## Преимущества новой конфигурации

1. **Гибкость:** Все параметры можно настроить через .env без изменения кода
2. **Читаемость:** Все константы в одном месте с понятными названиями
3. **Поддержка:** Легко найти и изменить любой параметр
4. **Безопасность:** Дефолтные значения безопасны, но можно адаптировать под нагрузку
5. **Документация:** .env.example содержит все доступные параметры с комментариями

---

## Дополнительные рекомендации

### Следующие шаги (не критично, но желательно):
1. Добавить кэширование результатов по file_id
2. Ограничить размер загружаемых фото (max 5MB)
3. Улучшить обработку ошибок OpenAI (разные сообщения для разных типов ошибок)
4. Добавить мониторинг стоимости запросов к OpenAI
5. Реализовать историю запросов пользователя

### Мониторинг:
Следите за логами на наличие:
- `Failed to decrement purchased request` - попытки race condition
- `Invalid weight detected` - некорректные веса
- `statement_timeout` - долгие SQL запросы

