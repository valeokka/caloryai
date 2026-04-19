# Установка оптимизаций

## Быстрый старт

```bash
# 1. Установить зависимость для сжатия изображений
npm install sharp

# 2. Перезапустить бота
pm2 restart calorie-bot

# 3. Проверить логи
pm2 logs calorie-bot --lines 50
```

Готово! Все оптимизации включены по умолчанию.

---

## Что установлено

✅ **Оптимизированный connection pool БД** - работает автоматически  
✅ **In-memory кэш для БД** - включен по умолчанию  
✅ **Сжатие изображений** - требует установки `sharp`  
✅ **Кэширование результатов по file_id** - включено по умолчанию  

---

## Настройка (опционально)

Если хочешь изменить параметры, добавь в `.env`:

```env
# Отключить сжатие изображений (если sharp не установлен)
IMAGE_COMPRESSION_ENABLED=false

# Отключить кэш БД (если мало памяти)
DB_CACHE_ENABLED=false

# Увеличить размер пула БД (для высокой нагрузки)
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=5

# Изменить качество сжатия
IMAGE_QUALITY=80
IMAGE_MAX_WIDTH=1600
```

---

## Проверка работы

### 1. Проверить сжатие изображений

Отправь фото в бота и проверь логи:

```bash
pm2 logs calorie-bot | grep "Image compressed"
```

Должно быть:
```
Image compressed successfully { 
  originalSize: '3.2MB', 
  compressedSize: '0.8MB', 
  compressionRatio: '75%' 
}
```

### 2. Проверить кэш БД

Отправь команду `/status` дважды подряд:

```bash
pm2 logs calorie-bot | grep "Cache hit"
```

Второй раз должен быть cache hit.

### 3. Проверить connection pool

```bash
pm2 logs calorie-bot | grep "pool"
```

Должны быть логи о подключениях (только в dev режиме).

---

## Troubleshooting

### Ошибка установки sharp на Windows

```bash
# Попробуй указать платформу явно
npm install --platform=win32 --arch=x64 sharp

# Или установи build tools
npm install --global windows-build-tools
npm install sharp
```

### Ошибка "Cannot find module 'sharp'"

```bash
# Проверь установку
npm list sharp

# Переустанови
npm uninstall sharp
npm install sharp
```

### Высокое использование памяти

Отключи кэш БД:
```bash
echo "DB_CACHE_ENABLED=false" >> .env
pm2 restart calorie-bot
```

### Медленное сжатие изображений

Отключи сжатие:
```bash
echo "IMAGE_COMPRESSION_ENABLED=false" >> .env
pm2 restart calorie-bot
```

---

## Откат изменений

Если что-то пошло не так, можно откатиться:

```bash
# Отключить все оптимизации
cat >> .env << EOF
IMAGE_COMPRESSION_ENABLED=false
DB_CACHE_ENABLED=false
CACHE_ENABLED=false
EOF

pm2 restart calorie-bot
```

Бот будет работать как раньше, но без оптимизаций.

---

## Мониторинг эффективности

### Проверить экономию на OpenAI

```bash
# До оптимизаций (примерно)
pm2 logs calorie-bot | grep "tokens" | tail -20

# После оптимизаций должно быть меньше токенов
```

### Проверить скорость обработки

```bash
# Время обработки фото
pm2 logs calorie-bot | grep "duration"
```

### Проверить попадания в кэш

```bash
# Процент попаданий в кэш
pm2 logs calorie-bot | grep -E "(Cache hit|Cache miss)" | \
  awk '{if($0~/hit/) hit++; else miss++} END {print "Hit rate:", hit/(hit+miss)*100"%"}'
```

---

## Дополнительная информация

- `PERFORMANCE.md` - подробное описание оптимизаций
- `IMPROVEMENTS.md` - описание всех улучшений
- `SECURITY_FIXES.md` - исправления безопасности
- `CHANGELOG.md` - полная история изменений
