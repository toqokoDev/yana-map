const {
  MAX_ACTIVE_REQUESTS_PER_USER,
  MAP_VISIBLE_DAYS_DONE,
  MAP_VISIBLE_DAYS_REJECTED,
} = require('./constants');

const API_DOCS = {
  title: 'ЖКХ Кличев — API',
  version: '1.0',
  baseUrl: '/api',
  endpoints: [
    {
      method: 'GET',
      path: '/api',
      auth: false,
      description: 'Справочник по API (этот ответ).',
    },
    {
      method: 'GET',
      path: '/api/map-data',
      auth: false,
      description: 'Данные карты: территории ЖКХ и объекты инфраструктуры.',
      response: {
        territories: 'массив территорий с polygon',
        objects: 'массив объектов с coordinates',
      },
    },
    {
      method: 'GET',
      path: '/api/requests/list',
      auth: false,
      description: 'Полный список заявок для боковой панели. Включает выполненные и отклонённые без ограничения по сроку.',
      response: {
        requests: 'массив заявок',
      },
    },
    {
      method: 'GET',
      path: '/api/requests/map',
      auth: false,
      description: 'Заявки для отображения на карте. Новые и «в работе» — всегда; выполненные — до N дней; отклонённые — до M дней.',
      response: {
        requests: 'массив заявок с координатами',
      },
      limits: {
        mapVisibleDaysDone: MAP_VISIBLE_DAYS_DONE,
        mapVisibleDaysRejected: MAP_VISIBLE_DAYS_REJECTED,
        maxItems: 100,
      },
    },
    {
      method: 'GET',
      path: '/api/requests',
      auth: false,
      description: 'Алиас для /api/requests/list (обратная совместимость).',
    },
    {
      method: 'POST',
      path: '/api/requests',
      auth: true,
      description: 'Создание заявки. Требуется авторизация.',
      body: {
        title: 'string, обязательно',
        description: 'string, обязательно',
        address: 'string, необязательно',
        lat: 'number, необязательно',
        lon: 'number, необязательно',
        photo: 'file (jpg/png/webp, до 5 МБ), необязательно',
      },
      limits: {
        maxActiveRequestsPerUser: MAX_ACTIVE_REQUESTS_PER_USER,
      },
    },
    {
      method: 'PUT',
      path: '/api/requests/:id',
      auth: true,
      description: 'Редактирование своей заявки. Доступно только для статусов new и in_progress.',
      body: {
        title: 'string, обязательно',
        description: 'string, обязательно',
        address: 'string, необязательно',
        lat: 'number, необязательно',
        lon: 'number, необязательно',
        photo: 'file, необязательно',
        removePhoto: '1 — удалить текущее фото',
      },
    },
    {
      method: 'DELETE',
      path: '/api/requests/:id',
      auth: true,
      description: 'Удаление своей заявки. Доступно только для статусов new и in_progress.',
    },
  ],
  requestObject: {
    id: 'number',
    title: 'string',
    description: 'string',
    address: 'string | null',
    photoUrl: 'string | null',
    status: 'new | in_progress | done | rejected',
    createdAt: 'ISO datetime',
    statusUpdatedAt: 'ISO datetime',
    authorName: 'string | null',
    canEdit: 'boolean',
    canDelete: 'boolean',
    coordinates: '{ lat, lon } | null',
  },
};

module.exports = API_DOCS;
