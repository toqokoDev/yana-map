const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const ROOT_DIR = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'scripts', 'objects.json');
const SCHEMA_FILE = path.join(ROOT_DIR, 'server', 'db', 'schema.sql');

async function createConnection(database) {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
}

async function initSchema() {
  const connection = await createConnection();
  const dbName = process.env.DB_NAME || 'karta';
  const escapedDbName = dbName.replace(/`/g, '``');
  const schemaSql = (await fs.readFile(SCHEMA_FILE, 'utf8')).replace(/`karta`/g, `\`${escapedDbName}\``);

  await connection.query(schemaSql);
  await connection.end();
}

async function importData() {
  await initSchema();

  const dbName = process.env.DB_NAME || 'karta';
  const connection = await createConnection(dbName);
  const rawData = await fs.readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(rawData);

  await connection.beginTransaction();

  try {
    await connection.query('DELETE FROM map_objects');
    await connection.query('DELETE FROM territory_points');
    await connection.query('DELETE FROM territories');

    for (const territory of data.территории || []) {
      const [result] = await connection.execute(
        `INSERT INTO territories (source_number, title, assigned_to)
         VALUES (?, ?, ?)`,
        [territory['№'], territory['название'], territory['за_кем_закреплено'] || null],
      );

      const territoryId = result.insertId;
      const points = territory['полигон'] || [];

      for (const [index, point] of points.entries()) {
        await connection.execute(
          `INSERT INTO territory_points (territory_id, point_order, lat, lon)
           VALUES (?, ?, ?, ?)`,
          [territoryId, index + 1, point.lat, point.lon],
        );
      }
    }

    for (const group of data.объекты || []) {
      for (const object of group['объекты'] || []) {
        const coordinates = object['координаты'];

        await connection.execute(
          `INSERT INTO map_objects
             (source_number, title, category, subcategory, address, description, lat, lon)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            object['№'],
            object['название'],
            group['категория'],
            group['подкатегория'],
            object['адрес'] || null,
            object['описание'] || null,
            coordinates ? coordinates.lat : null,
            coordinates ? coordinates.lon : null,
          ],
        );
      }
    }

    await connection.commit();
    console.log('Данные карты импортированы в MySQL.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

importData().catch((error) => {
  console.error('Ошибка импорта данных карты:', error);
  process.exitCode = 1;
});
