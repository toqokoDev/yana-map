const db = require('../config/db');

async function findUserById(id) {
  const [rows] = await db.execute(
    'SELECT id, full_name, email, created_at FROM users WHERE id = ? LIMIT 1',
    [id],
  );

  return rows[0] || null;
}

module.exports = { findUserById };
