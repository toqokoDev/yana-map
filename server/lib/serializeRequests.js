function toJsonSafeValue(value) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function mapRequestRow(row) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    photo_path: row.photo_path,
    photoUrl: row.photo_path || null,
    address: row.address,
    lat: row.lat != null ? Number(row.lat) : null,
    lon: row.lon != null ? Number(row.lon) : null,
    status: row.status,
    status_updated_at: toJsonSafeValue(row.status_updated_at),
    created_at: toJsonSafeValue(row.created_at),
    createdAt: toJsonSafeValue(row.created_at),
  };
}

function serializeRequestsForClient(requests) {
  const safe = (requests || []).map(mapRequestRow);
  return JSON.stringify(safe).replace(/</g, '\\u003c');
}

function encodeRequestCardData(row) {
  return encodeURIComponent(JSON.stringify(mapRequestRow(row)));
}

function prepareRequestsForProfileView(requests) {
  return (requests || []).map((row) => ({
    ...row,
    cardData: encodeRequestCardData(row),
  }));
}

module.exports = {
  serializeRequestsForClient,
  encodeRequestCardData,
  prepareRequestsForProfileView,
};
