const pool = require('../connection');

/**
 * Получить класс пользователя по ID
 */
async function getClassById(classId) {
  const query = 'SELECT * FROM user_classes WHERE id = $1';
  const result = await pool.query(query, [classId]);
  return result.rows[0];
}

/**
 * Получить класс пользователя по названию
 */
async function getClassByName(className) {
  const query = 'SELECT * FROM user_classes WHERE class_name = $1';
  const result = await pool.query(query, [className]);
  return result.rows[0];
}

module.exports = {
  getClassById,
  getClassByName,
};
