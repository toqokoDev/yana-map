const express = require('express');
const db = require('../../config/db');

const router = express.Router();

router.get('/map-data', async (req, res, next) => {
  try {
    const [territoriesRows] = await db.query(
      `SELECT
         t.id,
         t.source_number,
         t.title,
         t.assigned_to,
         tp.point_order,
         tp.lat,
         tp.lon
       FROM territories t
       LEFT JOIN territory_points tp ON tp.territory_id = t.id
       ORDER BY t.source_number, tp.point_order`,
    );

    const [objectsRows] = await db.query(
      `SELECT
         id,
         source_number,
         title,
         category,
         subcategory,
         address,
         description,
         lat,
         lon
       FROM map_objects
       ORDER BY category, subcategory, source_number`,
    );

    const territoriesMap = new Map();

    for (const row of territoriesRows) {
      if (!territoriesMap.has(row.id)) {
        territoriesMap.set(row.id, {
          id: row.id,
          sourceNumber: row.source_number,
          title: row.title,
          assignedTo: row.assigned_to,
          polygon: [],
        });
      }

      if (row.lat !== null && row.lon !== null) {
        territoriesMap.get(row.id).polygon.push({
          lat: Number(row.lat),
          lon: Number(row.lon),
        });
      }
    }

    const objects = objectsRows.map((row) => ({
      id: row.id,
      sourceNumber: row.source_number,
      title: row.title,
      category: row.category,
      subcategory: row.subcategory,
      address: row.address,
      description: row.description,
      coordinates:
        row.lat !== null && row.lon !== null
          ? { lat: Number(row.lat), lon: Number(row.lon) }
          : null,
    }));

    res.json({
      territories: Array.from(territoriesMap.values()),
      objects,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
