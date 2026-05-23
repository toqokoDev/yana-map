const express = require('express');
const { apiNotFoundHandler } = require('../../middleware/apiErrors');
const docsRouter = require('./docs');
const mapDataRouter = require('./mapData');
const requestsRouter = require('./requests');

const router = express.Router();

router.use('/', docsRouter);
router.use('/', mapDataRouter);
router.use('/', requestsRouter);
router.use(apiNotFoundHandler);

module.exports = router;
