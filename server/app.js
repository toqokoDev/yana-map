const path = require('path');
const express = require('express');
const sessionMiddleware = require('./config/session');
const loadCurrentUser = require('./middleware/currentUser');
const { apiErrorHandler, isApiRequest } = require('./middleware/apiErrors');
const routes = require('./routes');
const { ROOT_DIR } = require('./config/constants');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT_DIR, 'views'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(sessionMiddleware);
  app.use(loadCurrentUser);
  app.use(routes);
  app.use(express.static(ROOT_DIR));

  app.use((req, res) => {
    res.status(404).send('Страница не найдена');
  });

  app.use(apiErrorHandler);

  app.use((error, req, res, next) => {
    console.error(error);

    if (!isApiRequest(req) && req.accepts('html')) {
      const isDev = app.get('env') === 'development';
      const details = String(error.stack || error.message || error)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const body = isDev
        ? `<h1>Ошибка сервера</h1><pre style="white-space:pre-wrap;font:14px/1.4 monospace;">${details}</pre>`
        : '<h1>Ошибка сервера</h1><p>Попробуйте обновить страницу позже.</p>';

      return res.status(500).type('html').send(body);
    }

    res.status(500).json({
      message: 'Ошибка сервера',
    });
  });

  return app;
}

module.exports = createApp;
