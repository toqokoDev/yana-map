const API_BASE = '/api';

const DEFAULT_ERROR_MESSAGES = {
  400: 'Некорректный запрос.',
  401: 'Требуется авторизация.',
  403: 'Действие недоступно.',
  404: 'Данные не найдены.',
  429: 'Превышен лимит запросов.',
  500: 'Ошибка сервера.',
};

export class ApiError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path) {
  if (path.startsWith('/api')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

async function readJsonBody(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(status, body) {
  if (body && typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }

  return DEFAULT_ERROR_MESSAGES[status] || `Ошибка запроса (${status}).`;
}

/**
 * Базовый запрос к API. При ошибке бросает ApiError с текстом из ответа сервера.
 * @param {string} path — путь относительно /api (например, '/requests/list')
 * @param {RequestInit & { redirectOn401?: boolean }} options
 */
export async function apiRequest(path, options = {}) {
  const { redirectOn401 = true, ...fetchOptions } = options;
  const response = await fetch(buildUrl(path), {
    credentials: 'same-origin',
    ...fetchOptions,
  });
  const body = await readJsonBody(response);

  if (response.status === 401 && redirectOn401) {
    window.location.href = '/login';
    throw new ApiError(getErrorMessage(401, body), { status: 401, body });
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(response.status, body), {
      status: response.status,
      body,
    });
  }

  return body;
}

export const api = {
  getMapData() {
    return apiRequest('/map-data');
  },

  getRequestsList() {
    return apiRequest('/requests/list');
  },

  getRequestsForMap() {
    return apiRequest('/requests/map');
  },

  createRequest(formData) {
    return apiRequest('/requests', {
      method: 'POST',
      body: formData,
    });
  },

  updateRequest(requestId, formData) {
    return apiRequest(`/requests/${requestId}`, {
      method: 'PUT',
      body: formData,
    });
  },

  deleteRequest(requestId) {
    return apiRequest(`/requests/${requestId}`, {
      method: 'DELETE',
    });
  },
};
