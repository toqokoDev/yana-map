# API — ЖКХ Кличев

Базовый URL: `/api`

Справочник в JSON: `GET /api`

## Карта

### `GET /api/map-data`

Публичный. Территории ЖКХ и объекты инфраструктуры.

**Ответ:**
```json
{
  "territories": [
    {
      "id": 1,
      "sourceNumber": 1,
      "title": "Центральный район",
      "assignedTo": "УКП «Жилкомхоз»",
      "polygon": [{ "lat": 53.51, "lon": 29.33 }]
    }
  ],
  "objects": [
    {
      "id": 1,
      "title": "Колодец",
      "category": "Инженерная инфраструктура",
      "subcategory": "Водопроводные колодцы",
      "address": "ул. Ленинская, 1",
      "coordinates": { "lat": 53.49, "lon": 29.33 }
    }
  ]
}
```

## Заявки

### `GET /api/requests/list`

Публичный. **Полный список** заявок для боковой панели — без фильтра по сроку. Выполненные и отклонённые остаются в списке навсегда.

### `GET /api/requests/map`

Публичный. Заявки **только для карты** (до 100 шт.):

| Статус | На карте |
|--------|----------|
| `new`, `in_progress` | всегда |
| `done` | 7 дней после смены статуса |
| `rejected` | 2 дня после смены статуса |

Сроки настраиваются в `.env`: `MAP_VISIBLE_DAYS_DONE`, `MAP_VISIBLE_DAYS_REJECTED`.

### `GET /api/requests`

Алиас для `/api/requests/list`.

### `POST /api/requests`

**Требуется авторизация** (сессия).

Создание заявки. Тело запроса: `multipart/form-data`.

| Поле | Тип | Обязательно |
|------|-----|-------------|
| `title` | string | да |
| `description` | string | да |
| `address` | string | нет |
| `lat`, `lon` | number | нет |
| `photo` | file (jpg/png/webp, ≤ 5 МБ) | нет |

Лимит активных заявок на пользователя: `MAX_ACTIVE_REQUESTS_PER_USER` (по умолчанию 5).

### `PUT /api/requests/:id`

**Требуется авторизация.** Редактирование **своей** заявки. Только статусы `new` и `in_progress`.

Дополнительно: `removePhoto=1` — удалить фото.

### `DELETE /api/requests/:id`

**Требуется авторизация.** Удаление **своей** заявки. Только статусы `new` и `in_progress`.

## Объект заявки

```json
{
  "id": 1,
  "title": "Протечка",
  "description": "Течёт кран",
  "address": "ул. Ленинская, 51",
  "photoUrl": "/uploads/requests/photo.jpg",
  "status": "new",
  "createdAt": "2026-05-23T10:00:00.000Z",
  "statusUpdatedAt": "2026-05-23T10:00:00.000Z",
  "authorName": "Иванов И.И.",
  "canEdit": true,
  "canDelete": true,
  "coordinates": { "lat": 53.4939, "lon": 29.333 }
}
```

## Ошибки

Все ошибки API возвращают JSON одного формата:

```json
{ "message": "Текст ошибки для пользователя" }
```

На клиенте используйте модуль `js/common/api.js`:

```js
import { api, ApiError } from '../common/api.js';

try {
  const data = await api.getRequestsList();
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.message);
  }
}
```

| Метод `api` | HTTP |
|-------------|------|
| `getMapData()` | `GET /api/map-data` |
| `getRequestsList()` | `GET /api/requests/list` |
| `getRequestsForMap()` | `GET /api/requests/map` |
| `createRequest(formData)` | `POST /api/requests` |
| `updateRequest(id, formData)` | `PUT /api/requests/:id` |
| `deleteRequest(id)` | `DELETE /api/requests/:id` |

При `401` клиент перенаправляет на `/login` (отключается через `apiRequest(path, { redirectOn401: false })`).

## Коды ответов

| Код | Значение |
|-----|----------|
| 200 | Успех |
| 201 | Заявка создана |
| 400 | Некорректные данные |
| 401 | Нужна авторизация |
| 403 | Действие недоступно (статус заявки) |
| 404 | Не найдено (в т.ч. неизвестный путь `/api/...`) |
| 429 | Превышен лимит активных заявок |
| 500 | Ошибка сервера |
