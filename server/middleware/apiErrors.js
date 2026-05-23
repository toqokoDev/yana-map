const { sendError } = require('../lib/apiResponse');

function isApiRequest(req) {
  return req.originalUrl.startsWith('/api');
}

function apiNotFoundHandler(req, res) {
  sendError(res, 404, 'API-метод не найден.');
}

function apiErrorHandler(error, req, res, next) {
  if (!isApiRequest(req)) {
    return next(error);
  }

  console.error(error);

  const statusCode = error.statusCode || error.status || 500;
  const message =
    error.expose && error.message
      ? error.message
      : statusCode >= 500
        ? 'Ошибка сервера'
        : error.message || 'Ошибка запроса';

  sendError(res, statusCode, message);
}

module.exports = {
  isApiRequest,
  apiNotFoundHandler,
  apiErrorHandler,
};
