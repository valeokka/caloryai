-- Миграция: сделать photo_file_id nullable для текстовых записей

-- Разрешаем NULL для photo_file_id (для записей добавленных через текст)
ALTER TABLE requests_history 
ALTER COLUMN photo_file_id DROP NOT NULL;

-- Комментарий
COMMENT ON COLUMN requests_history.photo_file_id IS 'ID файла фото в Telegram (NULL для текстовых записей)';
