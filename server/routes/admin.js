const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { deleteRequestPhoto } = require('../lib/photos');

const router = express.Router();

router.get('/admin/login', (req, res) => {
  res.redirect('/login');
});

router.post('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/login');
});

router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const [requests] = await db.query(
      `SELECT
         sr.id,
         sr.title,
         sr.description,
         sr.photo_path,
         sr.address,
         sr.status,
         sr.status_updated_at,
         sr.created_at,
         u.full_name AS author_name,
         u.email AS author_email
       FROM service_requests sr
       LEFT JOIN users u ON u.id = sr.user_id
       ORDER BY sr.created_at DESC`,
    );
    const [categories] = await db.query(
      `SELECT DISTINCT category, subcategory
       FROM map_objects
       ORDER BY category, subcategory`,
    );
    const [mapObjects] = await db.query(
      `SELECT id, source_number, title, category, subcategory, address, description, lat, lon
       FROM map_objects
       ORDER BY category, subcategory, source_number`,
    );
    const groupedMapObjects = mapObjects.reduce((groups, object) => {
      if (!groups[object.category]) {
        groups[object.category] = {};
      }

      if (!groups[object.category][object.subcategory]) {
        groups[object.category][object.subcategory] = [];
      }

      groups[object.category][object.subcategory].push(object);
      return groups;
    }, {});

    res.render('admin-dashboard', {
      pageTitle: 'Админ панель',
      requests,
      categories,
      mapObjects,
      groupedMapObjects,
      statusLabels: {
        new: 'Новая',
        in_progress: 'В работе',
        done: 'Выполнена',
        rejected: 'Отклонена',
      },
      message: req.query.message || '',
      error: req.query.error || '',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/requests/:id/status', requireAdmin, async (req, res, next) => {
  const allowedStatuses = ['new', 'in_progress', 'done', 'rejected'];
  const status = String(req.body.status || '');

  try {
    if (!allowedStatuses.includes(status)) {
      return res.redirect('/admin?error=Некорректный статус заявки');
    }

    await db.execute(
      'UPDATE service_requests SET status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, Number(req.params.id)],
    );

    res.redirect('/admin?message=Статус заявки обновлен');
  } catch (error) {
    next(error);
  }
});

router.post('/admin/requests/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const [rows] = await db.execute('SELECT photo_path FROM service_requests WHERE id = ? LIMIT 1', [
      requestId,
    ]);

    await db.execute('DELETE FROM service_requests WHERE id = ?', [requestId]);

    if (rows[0]) {
      deleteRequestPhoto(rows[0].photo_path);
    }

    res.redirect('/admin?message=Заявка удалена');
  } catch (error) {
    next(error);
  }
});

router.post('/admin/map-objects', requireAdmin, async (req, res, next) => {
  const title = String(req.body.title || '').trim();
  const address = String(req.body.address || '').trim();
  const description = String(req.body.description || '').trim();
  const selectedCategory = String(req.body.category || '').trim();
  const selectedSubcategory = String(req.body.subcategory || '').trim();
  const newCategory = String(req.body.newCategory || '').trim();
  const newSubcategory = String(req.body.newSubcategory || '').trim();
  const category = newCategory || selectedCategory;
  const subcategory = newSubcategory || selectedSubcategory;
  const lat = Number(req.body.lat);
  const lon = Number(req.body.lon);

  try {
    if (!title || !category || !subcategory || Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.redirect('/admin?error=Заполните название, категорию, подкатегорию и координаты точки');
    }

    const [numberRows] = await db.query('SELECT COALESCE(MAX(source_number), 0) + 1 AS nextNumber FROM map_objects');
    const sourceNumber = numberRows[0].nextNumber;

    await db.execute(
      `INSERT INTO map_objects
         (source_number, title, category, subcategory, address, description, lat, lon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sourceNumber,
        title,
        category,
        subcategory,
        address || null,
        description || null,
        lat,
        lon,
      ],
    );

    res.redirect('/admin?message=Новая точка добавлена на карту');
  } catch (error) {
    next(error);
  }
});

router.post('/admin/map-objects/:id/update', requireAdmin, async (req, res, next) => {
  const title = String(req.body.title || '').trim();
  const address = String(req.body.address || '').trim();
  const description = String(req.body.description || '').trim();
  const selectedCategory = String(req.body.category || '').trim();
  const selectedSubcategory = String(req.body.subcategory || '').trim();
  const newCategory = String(req.body.newCategory || '').trim();
  const newSubcategory = String(req.body.newSubcategory || '').trim();
  const category = newCategory || selectedCategory;
  const subcategory = newSubcategory || selectedSubcategory;
  const lat = Number(req.body.lat);
  const lon = Number(req.body.lon);

  try {
    if (!title || !category || !subcategory || Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.redirect('/admin?error=Заполните название, категорию, подкатегорию и координаты точки');
    }

    await db.execute(
      `UPDATE map_objects
       SET title = ?, category = ?, subcategory = ?, address = ?, description = ?, lat = ?, lon = ?
       WHERE id = ?`,
      [
        title,
        category,
        subcategory,
        address || null,
        description || null,
        lat,
        lon,
        Number(req.params.id),
      ],
    );

    res.redirect('/admin?message=Точка обновлена');
  } catch (error) {
    next(error);
  }
});

router.post('/admin/map-objects/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await db.execute('DELETE FROM map_objects WHERE id = ?', [Number(req.params.id)]);
    res.redirect('/admin?message=Точка удалена с карты');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
