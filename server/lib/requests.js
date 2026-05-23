const { EDITABLE_REQUEST_STATUSES } = require('../config/constants');

function isRequestEditable(status) {
  return EDITABLE_REQUEST_STATUSES.includes(status);
}

function getMapVisibilitySql() {
  return `(
    sr.status IN ('new', 'in_progress')
    OR (sr.status = 'done' AND sr.status_updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY))
    OR (sr.status = 'rejected' AND sr.status_updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY))
  )`;
}

function getRequestsSelectSql() {
  return `
    sr.id,
    sr.title,
    sr.description,
    sr.photo_path,
    sr.address,
    sr.lat,
    sr.lon,
    sr.status,
    sr.status_updated_at,
    sr.user_id,
    sr.created_at,
    u.full_name AS author_name
  `;
}

function mapRequestRow(row, currentUser) {
  const isOwner = Boolean(currentUser && row.user_id === currentUser.id);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    address: row.address,
    photoUrl: row.photo_path || null,
    status: row.status,
    createdAt: row.created_at,
    statusUpdatedAt: row.status_updated_at,
    authorName: row.author_name,
    canEdit: isOwner && isRequestEditable(row.status),
    canDelete: isOwner && isRequestEditable(row.status),
    coordinates:
      row.lat !== null && row.lon !== null
        ? { lat: Number(row.lat), lon: Number(row.lon) }
        : null,
  };
}

module.exports = {
  isRequestEditable,
  getMapVisibilitySql,
  getRequestsSelectSql,
  mapRequestRow,
};
