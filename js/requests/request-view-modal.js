import { formatDate } from '../common/utils.js';
import { getRequestStatusText } from './status.js';

let currentRequests = [];
let profileRequests = [];
let viewModalInitialized = false;

export function setCurrentRequests(requests) {
  currentRequests = requests;
}

export function getCurrentRequests() {
  return currentRequests;
}

export function loadProfileRequests() {
  const dataElement = document.getElementById('profile-requests-data');

  if (!dataElement) {
    profileRequests = [];
    return profileRequests;
  }

  try {
    const raw = dataElement.textContent.trim();
    profileRequests = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Не удалось прочитать заявки профиля:', error);
    profileRequests = [];
  }

  return profileRequests;
}

function findRequestById(requestId) {
  const normalizedId = String(requestId);
  const match = (item) => String(item.id) === normalizedId;

  return currentRequests.find(match)
    || profileRequests.find(match)
    || null;
}

function readRequestFromCard(card) {
  if (!card) {
    return null;
  }

  const encoded = card.getAttribute('data-request-json');

  if (!encoded) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch (error) {
    console.error('Не удалось прочитать данные карточки заявки:', error);
    return null;
  }
}

function isProfilePage() {
  return document.body.classList.contains('profile-page');
}

function getClickTargetElement(target) {
  if (target instanceof Element) {
    return target;
  }

  if (target && target.parentElement instanceof Element) {
    return target.parentElement;
  }

  return null;
}

function resolveRequestViewTrigger(target) {
  const element = getClickTargetElement(target);

  if (!element) {
    return null;
  }

  const button = element.closest('[data-request-view-id]');

  if (button) {
    return button;
  }

  if (element.closest('button, a')) {
    return null;
  }

  const card = element.closest('.request-item--viewable');

  if (card) {
    return card.querySelector('[data-request-view-id]');
  }

  return null;
}

function normalizeRequestForView(request) {
  return {
    title: request.title || '',
    description: request.description || '',
    address: request.address || null,
    photoUrl: request.photoUrl || request.photo_path || null,
    status: request.status,
    createdAt: request.createdAt || request.created_at,
    authorName: request.authorName || request.author_name || null,
  };
}

function openRequestViewModal(request) {
  const modal = document.getElementById('request-view-modal');

  if (!modal) {
    return;
  }

  const data = normalizeRequestForView(request);
  const title = modal.querySelector('#request-view-modal-title');
  const status = modal.querySelector('#request-view-modal-status');
  const description = modal.querySelector('#request-view-modal-description');
  const addressRow = modal.querySelector('#request-view-modal-address-row');
  const address = modal.querySelector('#request-view-modal-address');
  const date = modal.querySelector('#request-view-modal-date');
  const authorRow = modal.querySelector('#request-view-modal-author-row');
  const author = modal.querySelector('#request-view-modal-author');
  const photoWrap = modal.querySelector('#request-view-modal-photo-wrap');
  const photo = modal.querySelector('#request-view-modal-photo');
  const noPhoto = modal.querySelector('#request-view-modal-no-photo');

  if (title) {
    title.textContent = data.title;
  }

  if (status) {
    status.textContent = getRequestStatusText(data.status);
    status.className = `request-status request-status--${data.status}`;
  }

  if (description) {
    description.textContent = data.description;
  }

  if (addressRow && address) {
    if (data.address) {
      addressRow.hidden = false;
      address.textContent = data.address;
    } else {
      addressRow.hidden = true;
      address.textContent = '';
    }
  }

  if (date) {
    date.textContent = formatDate(data.createdAt);
  }

  if (authorRow && author) {
    if (data.authorName) {
      authorRow.hidden = false;
      author.textContent = data.authorName;
    } else {
      authorRow.hidden = true;
      author.textContent = '';
    }
  }

  if (photoWrap && photo && noPhoto) {
    if (data.photoUrl) {
      photo.src = data.photoUrl;
      photo.alt = `Фото заявки: ${data.title}`;
      photoWrap.hidden = false;
      noPhoto.hidden = true;
    } else {
      photo.removeAttribute('src');
      photoWrap.hidden = true;
      noPhoto.hidden = false;
    }
  }

  if (isProfilePage() && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  if (isProfilePage()) {
    document.body.classList.add('profile-modal-open');
  }

  document.body.style.overflow = 'hidden';
}

function closeRequestViewModal() {
  const modal = document.getElementById('request-view-modal');

  if (!modal) {
    return;
  }

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('profile-modal-open');

  if (!document.getElementById('request-modal')?.classList.contains('is-open')) {
    if (!document.body.classList.contains('profile-page')) {
      document.body.style.overflow = '';
    } else {
      document.body.style.removeProperty('overflow');
    }
  }
}

export function initRequestViewModal() {
  const modal = document.getElementById('request-view-modal');

  if (!modal || viewModalInitialized) {
    return;
  }

  viewModalInitialized = true;

  const loadedProfileRequests = loadProfileRequests();

  if (loadedProfileRequests.length > 0 && currentRequests.length === 0) {
    setCurrentRequests(loadedProfileRequests);
  }

  const closeButton = modal.querySelector('.request-view-modal__close');

  if (closeButton) {
    closeButton.addEventListener('click', () => closeRequestViewModal());
  }

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeRequestViewModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeRequestViewModal();
    }
  });

  document.addEventListener('click', (event) => {
    const element = getClickTargetElement(event.target);

    if (!element) {
      return;
    }

    if (modal.classList.contains('is-open') && element.closest('a[href], [data-close-request-view-modal]')) {
      closeRequestViewModal();
    }

    if (!element.closest('.request-item--viewable, [data-request-view-id]')) {
      return;
    }

    const trigger = resolveRequestViewTrigger(element);

    if (!trigger) {
      return;
    }

    const requestId = trigger.getAttribute('data-request-view-id');

    if (!requestId) {
      return;
    }

    const card = trigger.closest('.request-item');
    let request = readRequestFromCard(card) || findRequestById(requestId);

    if (!request && document.getElementById('profile-requests-data')) {
      const loaded = loadProfileRequests();

      if (loaded.length > 0 && currentRequests.length === 0) {
        setCurrentRequests(loaded);
      }

      request = findRequestById(requestId);
    }

    if (!request) {
      return;
    }

    event.preventDefault();
    openRequestViewModal(request);
  });
}
