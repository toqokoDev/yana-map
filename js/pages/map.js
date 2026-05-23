import { api, ApiError } from '../common/api.js';
import { escapeHtml, formatDate } from '../common/utils.js';
import {
    attachObjectSearch,
    buildObjectSearchText,
} from '../map/object-search-ui.js';
import {
  getRequestStatusIcon,
  getRequestStatusText,
} from '../requests/status.js';
import {
  getCurrentRequests,
  initRequestViewModal,
  setCurrentRequests,
} from '../requests/request-view-modal.js';

let mapInstance = null;
let requestCollection = null;
let isPickingRequestPoint = false;
let pendingDeleteRequestId = null;
let searchableMapObjects = [];
let selectedSearchPlacemark = null;
let selectedSearchObjectId = null;
let selectedTerritoryPolygon = null;

const TERRITORY_POLYGON_STYLE = {
    fill: false,
    strokeColor: '#2D9CDB',
    strokeOpacity: 0.85,
    strokeWidth: 3,
    interactivityModel: 'default#geoObject',
};

function applyTerritoryPolygonStyle(polygon, state = 'default') {
    if (!polygon) {
        return;
    }

    if (state === 'selected') {
        polygon.options.set({
            fill: false,
            strokeColor: '#0B74D1',
            strokeOpacity: 1,
            strokeWidth: 5,
        });
        return;
    }

    if (state === 'hover') {
        polygon.options.set({
            fill: false,
            strokeColor: '#2D9CDB',
            strokeOpacity: 1,
            strokeWidth: 4,
        });
        return;
    }

    polygon.options.set(TERRITORY_POLYGON_STYLE);
}

function selectTerritoryPolygon(polygon) {
    if (selectedTerritoryPolygon && selectedTerritoryPolygon !== polygon) {
        applyTerritoryPolygonStyle(selectedTerritoryPolygon, 'default');
    }

    selectedTerritoryPolygon = polygon;
    applyTerritoryPolygonStyle(polygon, 'selected');
}

function clearSelectedTerritoryPolygon() {
    if (!selectedTerritoryPolygon) {
        return;
    }

    applyTerritoryPolygonStyle(selectedTerritoryPolygon, 'default');
    selectedTerritoryPolygon = null;
}

function createTerritoryPolygon(territory) {
    const polygonCoordinates = territory.polygon.map((point) => [point.lat, point.lon]);

    const polygon = new ymaps.Polygon([polygonCoordinates], {
        hintContent: territory.title,
        balloonContent: buildTerritoryBalloon(territory),
    }, {
        ...TERRITORY_POLYGON_STYLE,
    });

    polygon.events.add('mouseenter', () => {
        if (selectedTerritoryPolygon !== polygon) {
            applyTerritoryPolygonStyle(polygon, 'hover');
        }
    });

    polygon.events.add('mouseleave', () => {
        if (selectedTerritoryPolygon !== polygon) {
            applyTerritoryPolygonStyle(polygon, 'default');
        }
    });

    polygon.events.add('click', async (event) => {
        if (isPickingRequestPoint) {
            if (event.stopPropagation) {
                event.stopPropagation();
            }

            await selectRequestPoint(event.get('coords'), territory.title);
            return;
        }

        if (event.stopPropagation) {
            event.stopPropagation();
        }

        selectTerritoryPolygon(polygon);
        showSidebarInfo(
            territory.title,
            escapeHtml(territory.assignedTo || 'Ответственный не указан'),
        );
    });

    return polygon;
}


// ==========================================
// ФУНКЦИЯ НАСТРОЙКИ ЯНДЕКС КАРТЫ
// ==========================================
async function initMap() {
  const myMap = new ymaps.Map("map", {
      center:[53.4939, 29.3330], 
      zoom: 14,
      controls: ['zoomControl'] 
  });
  mapInstance = myMap;
  myMap.behaviors.disable('scrollZoom');

  try {
      const mapData = await api.getMapData();
      renderMapData(myMap, mapData);
      initRequestMapPick(myMap);
      myMap.events.add('click', () => {
          if (!isPickingRequestPoint) {
              clearSelectedTerritoryPolygon();
          }
      });
  } catch (error) {
      console.error(error);
      const message = error instanceof ApiError
          ? error.message
          : 'Проверьте подключение к серверу и базе данных.';
      showSidebarInfo('Ошибка загрузки', escapeHtml(message));
  }

  await loadRequests(myMap);
  refreshMapSize();
}

function initRequestForm() {
    const modal = document.getElementById('request-modal');
    const openButton = document.querySelector('.map-request-btn');
    const closeButton = modal.querySelector('.request-modal__close');
    const form = document.getElementById('request-form');
    const pickButton = document.getElementById('request-pick-point');
    const photoInput = document.getElementById('request-photo-input');
    const photoChooseButton = document.getElementById('request-photo-choose');
    const photoEmpty = document.getElementById('request-photo-empty');
    const photoUpload = document.getElementById('request-photo-upload');
    const photoRemoveButton = document.getElementById('request-photo-remove');

    if (!modal || !openButton || !form) {
        return;
    }

    const openPhotoPicker = () => {
        if (photoInput) {
            photoInput.click();
        }
    };

    if (photoInput) {
        photoInput.addEventListener('change', () => {
            updatePhotoPreview(photoInput.files[0] || null);
            if (form.elements.removePhoto) {
                form.elements.removePhoto.value = '0';
            }
        });
    }

    if (photoChooseButton) {
        photoChooseButton.addEventListener('click', (event) => {
            event.stopPropagation();
            openPhotoPicker();
        });
    }

    if (photoEmpty) {
        photoEmpty.addEventListener('click', openPhotoPicker);
    }

    if (photoUpload) {
        ['dragenter', 'dragover'].forEach((eventName) => {
            photoUpload.addEventListener(eventName, (event) => {
                event.preventDefault();
                photoUpload.classList.add('is-dragover');
            });
        });

        photoUpload.addEventListener('dragleave', (event) => {
            if (!photoUpload.contains(event.relatedTarget)) {
                photoUpload.classList.remove('is-dragover');
            }
        });

        photoUpload.addEventListener('drop', (event) => {
            event.preventDefault();
            photoUpload.classList.remove('is-dragover');

            const file = event.dataTransfer?.files?.[0];

            if (!file || !file.type.startsWith('image/') || !photoInput) {
                return;
            }

            const transfer = new DataTransfer();
            transfer.items.add(file);
            photoInput.files = transfer.files;
            updatePhotoPreview(file);

            if (form.elements.removePhoto) {
                form.elements.removePhoto.value = '0';
            }
        });
    }

    if (photoRemoveButton) {
        photoRemoveButton.addEventListener('click', (event) => {
            event.stopPropagation();
            clearPhotoSelection(form, { markRemoved: true });
        });
    }

    setPhotoUploadState(false);

    openButton.addEventListener('click', () => {
        resetRequestForm();
        openRequestModal();
    });
    if (closeButton) closeButton.addEventListener('click', () => closeRequestModal());
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeRequestModal();
        }
    });

    if (pickButton) {
        pickButton.addEventListener('click', () => {
            closeRequestModal({ keepMapPicking: true });
        });
    }

    const pickingCancelButton = document.getElementById('map-picking-cancel');
    if (pickingCancelButton) {
        pickingCancelButton.addEventListener('click', () => {
            setMapPickingMode(false);
            openRequestModal();
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await submitRequestForm(form, closeRequestModal);
    });
}

function refreshMapSize() {
    if (!mapInstance) {
        return;
    }

    window.requestAnimationFrame(() => {
        try {
            mapInstance.container.fitToViewport();
        } catch (error) {
            console.error(error);
        }
    });

    window.setTimeout(() => {
        try {
            mapInstance.container.fitToViewport();
        } catch (error) {
            console.error(error);
        }
    }, 300);
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.map-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && sidebar.classList.contains('is-open')) {
        sidebar.classList.remove('is-open');
    }

    if (overlay) {
        overlay.classList.remove('active');
    }

    if (!document.getElementById('request-modal')?.classList.contains('is-open')) {
        document.body.style.overflow = '';
    }
}

function setMapPickingMode(active) {
    const modal = document.getElementById('request-modal');
    const mapWrapper = document.getElementById('map-wrapper');
    const hint = document.getElementById('map-picking-hint');
    const pickButton = document.getElementById('request-pick-point');

    isPickingRequestPoint = active;

    if (modal) {
        modal.classList.toggle('request-modal--picking', active);
    }

    if (mapWrapper) {
        mapWrapper.classList.toggle('map-wrapper--picking', active);
    }

    if (hint) {
        hint.hidden = !active;
    }

    if (pickButton) {
        pickButton.textContent = active ? 'Кликните по карте' : 'Выбрать точку на карте';
    }

    if (active) {
        closeMobileSidebar();
        document.body.style.overflow = '';
        refreshMapSize();
        return;
    }

    refreshMapSize();
}

function openRequestModal() {
    const modal = document.getElementById('request-modal');

    if (!modal) {
        return;
    }

    closeMobileSidebar();
    setMapPickingMode(false);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    refreshMapSize();
}

function closeRequestModal(options = {}) {
    const modal = document.getElementById('request-modal');

    if (!modal) {
        return;
    }

    if (options.keepMapPicking) {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        setMapPickingMode(true);
        return;
    }

    modal.classList.remove('is-open', 'request-modal--picking');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setMapPickingMode(false);
    refreshMapSize();
}

function resetRequestForm() {
    const form = document.getElementById('request-form');
    const modalTitle = document.getElementById('request-modal-title');
    const submitButton = document.querySelector('.request-form__submit');
    const message = document.getElementById('request-form-message');

    if (form) {
        form.reset();
        form.elements.requestId.value = '';
        if (form.elements.removePhoto) {
            form.elements.removePhoto.value = '0';
        }
    }

    clearPhotoSelection(form);

    if (modalTitle) {
        modalTitle.textContent = 'Оставить заявку';
    }

    if (submitButton) {
        submitButton.textContent = 'Отправить заявку';
    }

    if (message) {
        message.textContent = '';
        message.classList.remove('is-error', 'is-success');
    }

    resetRequestCoordinates();
}

let requestPhotoPreviewUrl = null;

function revokeRequestPhotoPreviewUrl() {
    if (requestPhotoPreviewUrl) {
        URL.revokeObjectURL(requestPhotoPreviewUrl);
        requestPhotoPreviewUrl = null;
    }
}

function setPhotoUploadState(hasPhoto) {
    const upload = document.getElementById('request-photo-upload');
    const empty = document.getElementById('request-photo-empty');
    const selected = document.getElementById('request-photo-selected');

    if (upload) {
        upload.classList.toggle('has-photo', hasPhoto);
    }

    if (empty) {
        empty.hidden = hasPhoto;
    }

    if (selected) {
        selected.hidden = !hasPhoto;
    }
}

function clearPhotoSelection(form, options = {}) {
    const photoInput = document.getElementById('request-photo-input') || (form ? form.elements.photo : null);
    const photoImage = document.getElementById('request-photo-image');

    if (photoInput) {
        photoInput.value = '';
    }

    revokeRequestPhotoPreviewUrl();

    if (photoImage) {
        photoImage.removeAttribute('src');
    }

    setPhotoUploadState(false);

    if (options.markRemoved && form && form.elements.removePhoto) {
        form.elements.removePhoto.value = '1';
    }
}

function updatePhotoPreview(file) {
    const photoImage = document.getElementById('request-photo-image');

    if (!photoImage) {
        return;
    }

    if (!file) {
        revokeRequestPhotoPreviewUrl();
        photoImage.removeAttribute('src');
        setPhotoUploadState(false);
        return;
    }

    revokeRequestPhotoPreviewUrl();
    requestPhotoPreviewUrl = URL.createObjectURL(file);
    photoImage.src = requestPhotoPreviewUrl;
    setPhotoUploadState(true);
}

function showExistingPhotoPreview(photoUrl) {
    const photoImage = document.getElementById('request-photo-image');

    if (!photoImage || !photoUrl) {
        setPhotoUploadState(false);
        return;
    }

    revokeRequestPhotoPreviewUrl();
    photoImage.src = photoUrl;
    setPhotoUploadState(true);
}

function initRequestMapPick(myMap) {
    myMap.events.add('click', async (event) => {
        if (!isPickingRequestPoint) {
            return;
        }

        await selectRequestPoint(event.get('coords'));
    });
}

async function selectRequestPoint(coordinates, fallbackName = '') {
    const form = document.getElementById('request-form');
    const modal = document.getElementById('request-modal');
    const coordinatesText = document.getElementById('request-coordinates');
    const pickButton = document.getElementById('request-pick-point');

    if (!form || !modal || !coordinates) {
        return;
    }

    form.elements.lat.value = coordinates[0].toFixed(7);
    form.elements.lon.value = coordinates[1].toFixed(7);

    if (coordinatesText) {
        coordinatesText.textContent = 'Определяем адрес...';
    }

    const placeName = await getPlaceNameByCoordinates(coordinates, fallbackName);
    const addressInput = form.elements.address;

    if (addressInput) {
        addressInput.value = placeName;
    }

    if (coordinatesText) {
        coordinatesText.textContent = `Выбрано: ${placeName}`;
    }

    if (pickButton) {
        pickButton.textContent = 'Изменить точку на карте';
    }

    setMapPickingMode(false);
    openRequestModal();
}

async function getPlaceNameByCoordinates(coordinates, fallbackName = '') {
    try {
        const result = await ymaps.geocode(coordinates, { results: 1 });
        const firstGeoObject = result.geoObjects.get(0);

        if (firstGeoObject) {
            return firstGeoObject.getAddressLine();
        }
    } catch (error) {
        console.error(error);
    }

    return fallbackName || 'Выбранная точка на карте';
}

async function submitRequestForm(form, closeModal) {
    const message = document.getElementById('request-form-message');
    const submitButton = form.querySelector('.request-form__submit');
    const formData = new FormData(form);
    const requestId = formData.get('requestId');
    formData.delete('requestId');

    if (message) {
        message.textContent = '';
        message.classList.remove('is-error', 'is-success');
    }

    if (submitButton) {
        submitButton.disabled = true;
    }

    try {
        const result = requestId
            ? await api.updateRequest(requestId, formData)
            : await api.createRequest(formData);

        if (message) {
            message.textContent = result.message;
            message.classList.add('is-success');
        }

        resetRequestForm();
        resetRequestCoordinates();
        closeModal();
        await loadRequests(mapInstance);
        activateRequestsTab();
    } catch (error) {
        if (message) {
            message.textContent = error.message;
            message.classList.add('is-error');
        }
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

function isRequestVisibleOnMap(request) {
    if (request.status === 'new' || request.status === 'in_progress') {
        return true;
    }

    if (!request.statusUpdatedAt) {
        return true;
    }

    const updatedAt = new Date(request.statusUpdatedAt);
    const daysPassed = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (request.status === 'done') {
        return daysPassed <= 7;
    }

    if (request.status === 'rejected') {
        return daysPassed <= 2;
    }

    return false;
}

async function fetchRequestsList() {
    const data = await api.getRequestsList();
    return data.requests || [];
}

async function fetchRequestsForMap(listRequests) {
    try {
        const data = await api.getRequestsForMap();
        return data.requests || [];
    } catch (error) {
        console.error(error);
        return listRequests.filter((request) => isRequestVisibleOnMap(request));
    }
}

async function loadRequests(myMap) {
    const list = document.getElementById('requests-list');

    if (!list) {
        return;
    }

    try {
        const listRequests = await fetchRequestsList();
        renderRequestsList(listRequests);

        try {
            const mapRequests = await fetchRequestsForMap(listRequests);
            renderRequestsOnMap(myMap, mapRequests);
        } catch (mapError) {
            console.error(mapError);
            renderRequestsOnMap(myMap, listRequests.filter((request) => isRequestVisibleOnMap(request)));
        }
    } catch (error) {
        list.innerHTML = `
            <div class="requests-placeholder">
                <h4>Ошибка загрузки</h4>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

function renderRequestsList(requests) {
    const list = document.getElementById('requests-list');
    setCurrentRequests(requests);

    if (!list) {
        return;
    }

    if (requests.length === 0) {
        list.innerHTML = `
            <div class="requests-placeholder">
                <h4>Нет заявок</h4>
                <p>Нажмите “Оставить заявку”, чтобы создать первую.</p>
            </div>
        `;
        return;
    }

    const groups = [
        { status: 'new', title: 'Новые' },
        { status: 'in_progress', title: 'В работе' },
        { status: 'done', title: 'Выполненные' },
        { status: 'rejected', title: 'Отклонённые' },
    ];

    list.innerHTML = groups
        .map(({ status, title }) => {
            const groupRequests = requests.filter((request) => request.status === status);

            if (groupRequests.length === 0) {
                return '';
            }

            return `
                <h3 class="profile-requests__group-title">${title}</h3>
                <div class="profile-requests__list">
                    ${groupRequests.map((request) => renderRequestListItem(request)).join('')}
                </div>
            `;
        })
        .join('');

    bindRequestActions();
}

function renderRequestListItem(request) {
    return `
        <article class="request-item request-item--viewable">
            <div class="request-item__top">
                <h4>${escapeHtml(request.title)}</h4>
                <span class="request-status request-status--${escapeHtml(request.status)}">${getRequestStatusText(request.status)}</span>
            </div>
            <p>${escapeHtml(request.description)}</p>
            ${request.address ? `<span class="request-item__meta">Адрес: ${escapeHtml(request.address)}</span>` : ''}
            ${request.authorName ? `<span class="request-item__meta">Автор: ${escapeHtml(request.authorName)}</span>` : ''}
            <span class="request-item__date">${formatDate(request.createdAt)}</span>
            <div class="request-item__actions">
                <button class="request-item__button" type="button" data-request-view-id="${request.id}">Просмотреть</button>
                ${request.canEdit ? `<button class="request-item__button" type="button" data-request-edit="${request.id}">Редактировать</button>` : ''}
                ${request.canDelete ? `<button class="request-item__button request-item__button--danger" type="button" data-request-delete="${request.id}">Удалить</button>` : ''}
            </div>
        </article>
    `;
}

function bindRequestActions() {
    document.querySelectorAll('[data-request-edit]').forEach((button) => {
        button.addEventListener('click', () => {
            const request = getCurrentRequests().find((item) => String(item.id) === button.dataset.requestEdit);

            if (request) {
                openRequestEditModal(request);
            }
        });
    });

    document.querySelectorAll('[data-request-delete]').forEach((button) => {
        button.addEventListener('click', () => {
            openRequestDeleteModal(button.dataset.requestDelete);
        });
    });
}

function initRequestDeleteModal() {
    const modal = document.getElementById('request-delete-modal');

    if (!modal) {
        return;
    }

    const cancelButton = document.getElementById('request-delete-cancel');
    const confirmButton = document.getElementById('request-delete-confirm');
    const closeButton = modal.querySelector('.request-delete-modal__close');

    const closeModal = () => closeRequestDeleteModal();

    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal();
        }
    });

    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            await confirmRequestDelete(confirmButton, cancelButton);
        });
    }
}

function openRequestDeleteModal(requestId) {
    const modal = document.getElementById('request-delete-modal');
    const text = document.getElementById('request-delete-modal-text');
    const message = document.getElementById('request-delete-modal-message');

    if (!modal || !requestId) {
        return;
    }

    const request = getCurrentRequests().find((item) => String(item.id) === String(requestId));

    pendingDeleteRequestId = String(requestId);

    if (text) {
        text.textContent = request?.title
            ? `Заявка «${request.title}» будет удалена без возможности восстановления.`
            : 'Заявка будет удалена без возможности восстановления.';
    }

    if (message) {
        message.hidden = true;
        message.textContent = '';
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeRequestDeleteModal() {
    const modal = document.getElementById('request-delete-modal');
    const message = document.getElementById('request-delete-modal-message');
    const confirmButton = document.getElementById('request-delete-confirm');
    const cancelButton = document.getElementById('request-delete-cancel');

    if (!modal) {
        return;
    }

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    pendingDeleteRequestId = null;

    if (message) {
        message.hidden = true;
        message.textContent = '';
    }

    if (confirmButton) {
        confirmButton.disabled = false;
    }

    if (cancelButton) {
        cancelButton.disabled = false;
    }

    if (
        !document.getElementById('request-modal')?.classList.contains('is-open')
        && !document.getElementById('request-view-modal')?.classList.contains('is-open')
    ) {
        document.body.style.overflow = '';
    }
}

async function confirmRequestDelete(confirmButton, cancelButton) {
    if (!pendingDeleteRequestId) {
        return;
    }

    const requestId = pendingDeleteRequestId;
    const message = document.getElementById('request-delete-modal-message');

    if (confirmButton) {
        confirmButton.disabled = true;
    }

    if (cancelButton) {
        cancelButton.disabled = true;
    }

    if (message) {
        message.hidden = true;
        message.textContent = '';
    }

    try {
        await api.deleteRequest(requestId);
        closeRequestDeleteModal();
        await loadRequests(mapInstance);
    } catch (error) {
        const errorMessage = error instanceof ApiError
            ? error.message
            : 'Не удалось удалить заявку';

        if (message) {
            message.textContent = errorMessage;
            message.hidden = false;
        }
    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
        }

        if (cancelButton) {
            cancelButton.disabled = false;
        }
    }
}

function openRequestEditModal(request) {
    const form = document.getElementById('request-form');
    const modalTitle = document.getElementById('request-modal-title');
    const submitButton = document.querySelector('.request-form__submit');
    const message = document.getElementById('request-form-message');

    if (!form) {
        return;
    }

    form.elements.requestId.value = request.id;
    form.elements.title.value = request.title || '';
    form.elements.address.value = request.address || '';
    form.elements.description.value = request.description || '';
    form.elements.lat.value = request.coordinates ? request.coordinates.lat : '';
    form.elements.lon.value = request.coordinates ? request.coordinates.lon : '';

    if (form.elements.removePhoto) {
        form.elements.removePhoto.value = '0';
    }

    clearPhotoSelection(form);
    if (request.photoUrl) {
        showExistingPhotoPreview(request.photoUrl);
    }

    if (modalTitle) {
        modalTitle.textContent = 'Редактировать заявку';
    }

    if (submitButton) {
        submitButton.textContent = 'Сохранить изменения';
    }

    if (message) {
        message.textContent = '';
        message.classList.remove('is-error', 'is-success');
    }

    const coordinatesText = document.getElementById('request-coordinates');
    if (coordinatesText) {
        coordinatesText.textContent = request.address
            ? `Выбрано: ${request.address}`
            : 'Точка на карте не выбрана';
    }

    openRequestModal();
}

function renderRequestsOnMap(myMap, requests) {
    if (!myMap) {
        return;
    }

    if (requestCollection) {
        myMap.geoObjects.remove(requestCollection);
    }

    requestCollection = new ymaps.GeoObjectCollection();

    requests.forEach((request) => {
        if (!request.coordinates) {
            return;
        }

        const coordinates = [request.coordinates.lat, request.coordinates.lon];
        const placemark = new ymaps.Placemark(
            coordinates,
            {
                hintContent: request.title,
                balloonContent: buildRequestBalloon(request),
            },
            {
                preset: getRequestPreset(request.status),
            },
        );

        placemark.events.add('click', async (event) => {
            if (!isPickingRequestPoint) {
                return;
            }

            if (event.stopPropagation) {
                event.stopPropagation();
            }

            await selectRequestPoint(coordinates, request.address || request.title);
        });

        requestCollection.add(placemark);
    });

    myMap.geoObjects.add(requestCollection);
}

function renderMapData(myMap, mapData) {
    const layerCollections = new Map();
    const bounds = [];
    searchableMapObjects = [];

    const getCollection = (layerName) => {
        if (!layerCollections.has(layerName)) {
            const collection = new ymaps.GeoObjectCollection();
            layerCollections.set(layerName, collection);
        }

        return layerCollections.get(layerName);
    };

    (mapData.territories || []).forEach((territory) => {
        if (!territory.polygon || territory.polygon.length === 0) {
            return;
        }

        const polygonCoordinates = territory.polygon.map((point) => [point.lat, point.lon]);
        bounds.push(...polygonCoordinates);

        const polygon = createTerritoryPolygon(territory);

        getCollection('Территории ЖКХ').add(polygon);
    });

    (mapData.objects || []).forEach((object) => {
        if (!object.coordinates) {
            return;
        }

        const coordinates = [object.coordinates.lat, object.coordinates.lon];
        bounds.push(coordinates);

        const placemark = new ymaps.Placemark(coordinates, {
            hintContent: object.title,
            balloonContent: buildObjectBalloon(object),
        }, {
            preset: getObjectPreset(object.category),
        });

        placemark.events.add('click', async (event) => {
            if (isPickingRequestPoint) {
                if (event.stopPropagation) {
                    event.stopPropagation();
                }

                await selectRequestPoint(coordinates, object.address || object.title);
                return;
            }

            clearSelectedTerritoryPolygon();

            const description = [
                object.address ? `Адрес: ${escapeHtml(object.address)}` : '',
                object.description ? escapeHtml(object.description) : '',
                `Категория: ${escapeHtml(object.category)}`,
                `Слой: ${escapeHtml(object.subcategory)}`,
            ].filter(Boolean).join('<br>');

            showSidebarInfo(object.title, description);
        });

        searchableMapObjects.push({
            object,
            placemark,
            coordinates,
            searchText: buildObjectSearchText(object),
        });

        getCollection(object.subcategory).add(placemark);
    });

    setupLayerControls(myMap, layerCollections);
    setupMapObjectSearch(myMap);

    if (bounds.length > 0) {
        myMap.setBounds(ymaps.util.bounds.fromPoints(bounds), {
            checkZoomRange: true,
            zoomMargin: 40,
        });
    }
}

function setupLayerControls(myMap, layerCollections) {
    const checkboxes = document.querySelectorAll('.layer-item__checkbox');
    const usedCollections = new Set();

    checkboxes.forEach((checkbox) => {
        const layerName = getLayerNameFromCheckbox(checkbox);
        const collection = findCollectionByLayerName(layerCollections, layerName);

        if (!collection) {
            return;
        }

        usedCollections.add(collection);

        const updateCollectionVisibility = () => {
            if (checkbox.checked) {
                myMap.geoObjects.add(collection);
            } else {
                myMap.geoObjects.remove(collection);
            }
        };

        checkbox.addEventListener('change', updateCollectionVisibility);
        updateCollectionVisibility();
    });

    layerCollections.forEach((collection) => {
        if (!usedCollections.has(collection)) {
            myMap.geoObjects.add(collection);
        }
    });
}

function setupMapObjectSearch(myMap) {
    const roots = [
        {
            input: document.querySelector('.sidebar-search__input'),
            results: document.getElementById('sidebar-search-results'),
            button: document.querySelector('.sidebar-search__button'),
        },
        {
            input: document.querySelector('.search-form__input'),
            results: document.getElementById('header-search-results'),
            button: document.querySelector('.search-form__button'),
        },
    ].filter((root) => root.input && root.results);

    if (roots.length === 0) {
        return;
    }

    attachObjectSearch({
        roots,
        getSearchableItems: () => searchableMapObjects,
        isSelected: (item) => String(selectedSearchObjectId) === String(item.object.id),
        onSelect: (item) => {
            selectedSearchObjectId = item.object.id;
            clearSelectedTerritoryPolygon();
            saveSearchToQuery(item);
            focusMapObject(myMap, item);
        },
        onClear: () => clearSelectedSearchResult(myMap),
        restoreFromQuery: true,
    });
}

function saveSearchToQuery(item) {
    const params = new URLSearchParams(window.location.search);
    params.set('object', item.object.id);
    params.set('q', item.object.title);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function clearSelectedSearchResult(myMap) {
    selectedSearchObjectId = null;

    if (selectedSearchPlacemark) {
        myMap.geoObjects.remove(selectedSearchPlacemark);
        selectedSearchPlacemark = null;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete('object');
    params.delete('q');
    const queryString = params.toString();
    window.history.replaceState({}, '', queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname);
    loadRequests(myMap);
}

function focusMapObject(myMap, item) {
    if (!item) {
        return;
    }

    showSelectedSearchMarker(myMap, item);
    myMap.setCenter(item.coordinates, 17, {
        checkZoomRange: true,
        duration: 300,
    });
    try {
        item.placemark.balloon.open();
    } catch (error) {
        console.error(error);
    }

    const description = [
        item.object.address ? `Адрес: ${escapeHtml(item.object.address)}` : '',
        item.object.description ? escapeHtml(item.object.description) : '',
        `Категория: ${escapeHtml(item.object.category)}`,
        `Слой: ${escapeHtml(item.object.subcategory)}`,
    ].filter(Boolean).join('<br>');

    showSidebarInfo(item.object.title, description);
}

function showSelectedSearchMarker(myMap, item) {
    if (selectedSearchPlacemark) {
        myMap.geoObjects.remove(selectedSearchPlacemark);
    }

    selectedSearchPlacemark = new ymaps.Placemark(
        item.coordinates,
        {
            hintContent: `Выбрано: ${item.object.title}`,
            balloonContent: buildObjectBalloon(item.object),
        },
        {
            preset: 'islands#blueStarIcon',
            zIndex: 1000,
        },
    );

    myMap.geoObjects.add(selectedSearchPlacemark);
}

function getLayerNameFromCheckbox(checkbox) {
    const label = checkbox.closest('.layer-item');
    const text = label ? label.querySelector('.layer-item__text') : null;

    return text ? text.textContent.trim() : '';
}

function findCollectionByLayerName(layerCollections, layerName) {
    if (layerCollections.has(layerName)) {
        return layerCollections.get(layerName);
    }

    const normalizedLayerName = normalizeLayerName(layerName);

    for (const [collectionName, collection] of layerCollections.entries()) {
        if (normalizeLayerName(collectionName) === normalizedLayerName) {
            return collection;
        }
    }

    return null;
}

function normalizeLayerName(layerName) {
    return layerName
        .replace(/^Контейнерные\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function showSidebarInfo(title, description) {
    const card = document.querySelector('.sidebar-info__card');

    if (!card) {
        return;
    }

    card.innerHTML = '';

    const heading = document.createElement('h4');
    heading.textContent = title;

    const text = document.createElement('p');
    text.innerHTML = description;

    card.append(heading, text);
}

function buildTerritoryBalloon(territory) {
    return `
        <strong>${escapeHtml(territory.title)}</strong><br>
        ${escapeHtml(territory.assignedTo || 'Ответственный не указан')}
    `;
}

function buildObjectBalloon(object) {
    return `
        <strong>${escapeHtml(object.title)}</strong><br>
        ${object.address ? `${escapeHtml(object.address)}<br>` : ''}
        <small>${escapeHtml(object.category)} / ${escapeHtml(object.subcategory)}</small>
        ${object.description ? `<br>${escapeHtml(object.description)}` : ''}
    `;
}

function getObjectPreset(category) {
    const presets = {
        'Инженерная инфраструктура': 'islands#blueDotIcon',
        'Хозяйственная инфраструктура': 'islands#darkGreenDotIcon',
        'Санитарное содержание': 'islands#orangeDotIcon',
        'Благоустройство и досуг': 'islands#violetDotIcon',
        'Озеленение': 'islands#greenDotIcon',
    };

    return presets[category] || 'islands#redDotIcon';
}

function buildRequestBalloon(request) {
    return `
        <strong>${escapeHtml(request.title)}</strong><br>
        ${escapeHtml(request.description)}<br>
        ${request.address ? `Адрес: ${escapeHtml(request.address)}<br>` : ''}
        ${request.photoUrl ? `<a href="${escapeHtml(request.photoUrl)}" target="_blank" rel="noopener">Фото</a><br>` : ''}
        <small>${getRequestStatusIcon(request.status)} Статус: ${getRequestStatusText(request.status)}</small>
    `;
}

function getRequestPreset(status) {
    const presets = {
        new: 'islands#redAttentionIcon',
        in_progress: 'islands#yellowIcon',
        done: 'islands#greenCircleDotIcon',
        rejected: 'islands#grayIcon',
    };

    return presets[status] || 'islands#redAttentionIcon';
}


function resetRequestCoordinates() {
    const coordinatesText = document.getElementById('request-coordinates');

    if (coordinatesText) {
        coordinatesText.textContent = 'Точка на карте не выбрана';
    }
}

function activateRequestsTab() {
    const requestsTab = document.querySelector('.map-sidebar__tab[data-tab="requests"]');

    if (requestsTab) {
        requestsTab.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('map') && typeof ymaps !== 'undefined') {
    ymaps.ready(initMap);
  }

  const tabs = document.querySelectorAll('.map-sidebar__tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panes.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');

      const targetId = tab.getAttribute('data-tab');
      const targetPane = document.getElementById(`tab-${targetId}`);

      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  const sidebarScroll = document.getElementById('sidebar-scroll');
  const sidebarDots = document.getElementById('sidebar-dots');

  if (sidebarScroll && sidebarDots) {
    const checkScrollPosition = () => {
      const isAtBottom = sidebarScroll.scrollHeight - sidebarScroll.scrollTop <= sidebarScroll.clientHeight + 2;

      if (isAtBottom) {
        sidebarDots.classList.add('hidden');
      } else {
        sidebarDots.classList.remove('hidden');
      }
    };

    checkScrollPosition();
    sidebarScroll.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkScrollPosition);
  }

  initRequestForm();
  initRequestViewModal();
  initRequestDeleteModal();

  const sidebar = document.querySelector('.map-sidebar');
  const toggleBtn = document.querySelector('.map-sidebar-toggle');
  const closeBtn = document.querySelector('.map-sidebar__close');
  const overlay = document.querySelector('.sidebar-overlay');

  if (toggleBtn && sidebar) {
    const toggleSidebar = () => {
      sidebar.classList.toggle('is-open');
      overlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('is-open') ? 'hidden' : '';
      refreshMapSize();
    };

    toggleBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);
  }
});
