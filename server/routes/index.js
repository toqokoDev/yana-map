const express = require('express');
const pagesRouter = require('./pages');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const adminRouter = require('./admin');
const apiRouter = require('./api');

const router = express.Router();

router.use('/', pagesRouter);
router.use('/', authRouter);
router.use('/', profileRouter);
router.use('/', adminRouter);
router.use('/api', apiRouter);

module.exports = router;
