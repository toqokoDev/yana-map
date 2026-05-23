const express = require('express');
const {
  MAX_ACTIVE_REQUESTS_PER_USER,
  MAP_VISIBLE_DAYS_DONE,
  MAP_VISIBLE_DAYS_REJECTED,
} = require('../config/constants');

const router = express.Router();

router.get(['/', '/index.html'], (req, res) => {
  res.render('index', {
    pageTitle: 'ЖКХ Кличев - Главная страница',
  });
});

router.get(['/map', '/map.html'], (req, res) => {
  res.render('map', {
    pageTitle: 'ЖКХ Кличев - Интерактивная карта',
  });
});

router.get(['/user-guide', '/user-guide.html'], (req, res) => {
  res.render('user-guide', {
    pageTitle: 'ЖКХ Кличев - Руководство пользователя',
    maxActiveRequests: MAX_ACTIVE_REQUESTS_PER_USER,
    mapVisibleDaysDone: MAP_VISIBLE_DAYS_DONE,
    mapVisibleDaysRejected: MAP_VISIBLE_DAYS_REJECTED,
  });
});

module.exports = router;
