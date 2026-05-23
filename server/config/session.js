const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'karta',
  charset: 'utf8mb4_bin',
  schema: {
    tableName: 'sessions',
  },
});

const sessionMiddleware = session({
  name: 'karta.sid',
  secret: process.env.SESSION_SECRET || 'change_this_secret_in_env',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});

module.exports = sessionMiddleware;
