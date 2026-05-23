const multer = require('multer');
const { sendError } = require('../lib/apiResponse');

function handleUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'Размер фото не должен превышать 5 МБ.');
    }

    return sendError(res, 400, 'Не удалось загрузить фото.');
  }

  if (error) {
    return sendError(res, 400, error.message || 'Не удалось загрузить фото.');
  }

  next();
}

module.exports = handleUploadError;
