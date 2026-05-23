const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { MAP_VISIBLE_DAYS_DONE, MAP_VISIBLE_DAYS_REJECTED } = require('../config/constants');
const {
  serializeRequestsForClient,
  prepareRequestsForProfileView,
} = require('../lib/serializeRequests');

const router = express.Router();

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const [requests] = await db.execute(
      `SELECT id, title, description, photo_path, address, lat, lon, status, status_updated_at, created_at
       FROM service_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.currentUser.id],
    );

    res.render('profile', {
      pageTitle: 'Профиль',
      currentUser: req.currentUser,
      requests: prepareRequestsForProfileView(requests),
      requestsJson: serializeRequestsForClient(requests),
      mapVisibleDaysDone: MAP_VISIBLE_DAYS_DONE,
      mapVisibleDaysRejected: MAP_VISIBLE_DAYS_REJECTED,
    });
  } catch (error) {
    console.error('Ошибка страницы профиля:', error);
    next(error);
  }
});

module.exports = router;
