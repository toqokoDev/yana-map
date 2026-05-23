const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../config/constants');

function deleteRequestPhoto(photoPath) {
  if (!photoPath) {
    return;
  }

  const absolutePath = path.join(ROOT_DIR, photoPath.replace(/^\//, ''));

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

module.exports = { deleteRequestPhoto };
