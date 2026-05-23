const express = require('express');
const API_DOCS = require('../../config/apiDocs');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(API_DOCS);
});

module.exports = router;
