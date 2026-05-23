class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.expose = statusCode < 500;
  }
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ message });
}

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

module.exports = {
  HttpError,
  sendError,
  sendJson,
};
