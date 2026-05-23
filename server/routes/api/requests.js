const express = require('express');
const db = require('../../config/db');
const { sendError, sendJson } = require('../../lib/apiResponse');
const upload = require('../../config/upload');
const { requireApiAuth } = require('../../middleware/auth');
const handleUploadError = require('../../middleware/uploadError');
const { deleteRequestPhoto } = require('../../lib/photos');
const {
  isRequestEditable,
  getMapVisibilitySql,
  getRequestsSelectSql,
  mapRequestRow,
} = require('../../lib/requests');
const {
  MAX_ACTIVE_REQUESTS_PER_USER,
  MAP_VISIBLE_DAYS_DONE,
  MAP_VISIBLE_DAYS_REJECTED,
} = require('../../config/constants');

const router = express.Router();

async function listRequestsHandler(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT ${getRequestsSelectSql()}
       FROM service_requests sr
       LEFT JOIN users u ON u.id = sr.user_id
       ORDER BY sr.created_at DESC`,
    );

    res.json({
      requests: rows.map((row) => mapRequestRow(row, req.currentUser)),
    });
  } catch (error) {
    next(error);
  }
}

async function mapRequestsHandler(req, res, next) {
  try {
    const mapVisibilitySql = getMapVisibilitySql();
    const [rows] = await db.query(
      `SELECT ${getRequestsSelectSql()}
       FROM service_requests sr
       LEFT JOIN users u ON u.id = sr.user_id
       WHERE ${mapVisibilitySql}
       ORDER BY sr.created_at DESC
       LIMIT 100`,
      [MAP_VISIBLE_DAYS_DONE, MAP_VISIBLE_DAYS_REJECTED],
    );

    res.json({
      requests: rows.map((row) => mapRequestRow(row, req.currentUser)),
    });
  } catch (error) {
    next(error);
  }
}

router.get('/requests/list', listRequestsHandler);
router.get('/requests/map', mapRequestsHandler);
router.get('/requests', listRequestsHandler);

router.post(
  '/requests',
  requireApiAuth,
  upload.single('photo'),
  handleUploadError,
  async (req, res, next) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const address = String(req.body.address || '').trim();
    const lat = req.body.lat === '' || req.body.lat === undefined ? null : Number(req.body.lat);
    const lon = req.body.lon === '' || req.body.lon === undefined ? null : Number(req.body.lon);
    const photoPath = req.file ? `/uploads/requests/${req.file.filename}` : null;

    try {
      if (!title || !description) {
        if (req.file) {
          deleteRequestPhoto(photoPath);
        }

        return sendError(res, 400, 'Укажите тему и описание заявки.');
      }

      if ((lat !== null && Number.isNaN(lat)) || (lon !== null && Number.isNaN(lon))) {
        if (req.file) {
          deleteRequestPhoto(photoPath);
        }

        return sendError(res, 400, 'Некорректные координаты заявки.');
      }

      const [activeCountRows] = await db.execute(
        `SELECT COUNT(*) AS count
       FROM service_requests
       WHERE user_id = ? AND status IN ('new', 'in_progress')`,
        [req.currentUser.id],
      );
      const activeCount = activeCountRows[0].count;

      if (activeCount >= MAX_ACTIVE_REQUESTS_PER_USER) {
        if (req.file) {
          deleteRequestPhoto(photoPath);
        }

        return sendError(
          res,
          429,
          `Достигнут лимит активных заявок (${MAX_ACTIVE_REQUESTS_PER_USER}). Дождитесь выполнения или отмените существующие.`,
        );
      }

      const [result] = await db.execute(
        `INSERT INTO service_requests (user_id, title, description, photo_path, address, lat, lon)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.currentUser.id, title, description, photoPath, address || null, lat, lon],
      );

      sendJson(res, 201, {
        message: 'Заявка отправлена.',
        request: {
          id: result.insertId,
          title,
          description,
          address: address || null,
          photoUrl: photoPath,
          status: 'new',
          authorName: req.currentUser.full_name,
          canEdit: true,
          canDelete: true,
          coordinates: lat !== null && lon !== null ? { lat, lon } : null,
        },
      });
    } catch (error) {
      if (req.file) {
        deleteRequestPhoto(photoPath);
      }

      next(error);
    }
  },
);

router.put(
  '/requests/:id',
  requireApiAuth,
  upload.single('photo'),
  handleUploadError,
  async (req, res, next) => {
    const requestId = Number(req.params.id);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const address = String(req.body.address || '').trim();
    const lat = req.body.lat === '' || req.body.lat === undefined ? null : Number(req.body.lat);
    const lon = req.body.lon === '' || req.body.lon === undefined ? null : Number(req.body.lon);
    const removePhoto = String(req.body.removePhoto || '') === '1';
    const newPhotoPath = req.file ? `/uploads/requests/${req.file.filename}` : null;

    try {
      const [existingRows] = await db.execute(
        'SELECT id, status, photo_path FROM service_requests WHERE id = ? AND user_id = ? LIMIT 1',
        [requestId, req.currentUser.id],
      );
      const existingRequest = existingRows[0];

      if (!existingRequest) {
        if (newPhotoPath) {
          deleteRequestPhoto(newPhotoPath);
        }

        return sendError(res, 404, 'Заявка не найдена или недоступна для редактирования.');
      }

      if (!isRequestEditable(existingRequest.status)) {
        if (newPhotoPath) {
          deleteRequestPhoto(newPhotoPath);
        }

        return sendError(res, 403, 'Редактировать можно только новые заявки.');
      }

      if (!title || !description) {
        if (newPhotoPath) {
          deleteRequestPhoto(newPhotoPath);
        }

        return sendError(res, 400, 'Укажите тему и описание заявки.');
      }

      if ((lat !== null && Number.isNaN(lat)) || (lon !== null && Number.isNaN(lon))) {
        if (newPhotoPath) {
          deleteRequestPhoto(newPhotoPath);
        }

        return sendError(res, 400, 'Некорректные координаты заявки.');
      }

      let photoPath = existingRequest.photo_path;

      if (removePhoto) {
        deleteRequestPhoto(existingRequest.photo_path);
        photoPath = null;
      }

      if (newPhotoPath) {
        deleteRequestPhoto(existingRequest.photo_path);
        photoPath = newPhotoPath;
      }

      const [result] = await db.execute(
        `UPDATE service_requests
       SET title = ?, description = ?, photo_path = ?, address = ?, lat = ?, lon = ?
       WHERE id = ? AND user_id = ? AND status = 'new'`,
        [title, description, photoPath, address || null, lat, lon, requestId, req.currentUser.id],
      );

      if (result.affectedRows === 0) {
        if (newPhotoPath) {
          deleteRequestPhoto(newPhotoPath);
        }

        return sendError(res, 403, 'Редактировать можно только новые заявки.');
      }

      sendJson(res, 200, {
        message: 'Заявка обновлена.',
      });
    } catch (error) {
      if (newPhotoPath) {
        deleteRequestPhoto(newPhotoPath);
      }

      next(error);
    }
  },
);

router.delete('/requests/:id', requireApiAuth, async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const [existingRows] = await db.execute(
      'SELECT id, status, photo_path FROM service_requests WHERE id = ? AND user_id = ? LIMIT 1',
      [requestId, req.currentUser.id],
    );
    const existingRequest = existingRows[0];

    if (!existingRequest) {
      return sendError(res, 404, 'Заявка не найдена или недоступна для удаления.');
    }

    if (!isRequestEditable(existingRequest.status)) {
      return sendError(res, 403, 'Удалить можно только новые заявки.');
    }

    const [result] = await db.execute(
      `DELETE FROM service_requests
       WHERE id = ? AND user_id = ? AND status = 'new'`,
      [requestId, req.currentUser.id],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 403, 'Удалить можно только новые заявки.');
    }

    deleteRequestPhoto(existingRequest.photo_path);

    sendJson(res, 200, {
      message: 'Заявка удалена.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
