const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

module.exports = {
  ROOT_DIR,
  PORT: Number(process.env.PORT || 3000),
  MAX_ACTIVE_REQUESTS_PER_USER: Number(process.env.MAX_ACTIVE_REQUESTS_PER_USER || 5),
  MAP_VISIBLE_DAYS_DONE: Number(process.env.MAP_VISIBLE_DAYS_DONE || 7),
  MAP_VISIBLE_DAYS_REJECTED: Number(process.env.MAP_VISIBLE_DAYS_REJECTED || 2),
  EDITABLE_REQUEST_STATUSES: ['new'],
  UPLOADS_DIR: path.join(ROOT_DIR, 'uploads', 'requests'),
};
