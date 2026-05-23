(function profileModalInit() {
  const STATUS_LABELS = {
    new: 'Новая',
    in_progress: 'В работе',
    done: 'Выполнена',
    rejected: 'Отклонена',
  };

  function formatDate(value) {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function readProfileRequests() {
    const dataElement = document.getElementById('profile-requests-data');

    if (!dataElement) {
      return [];
    }

    try {
      const raw = dataElement.textContent.trim();
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('Не удалось прочитать заявки профиля:', error);
      return [];
    }
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

  function findRequest(requestId, requests) {
    const normalizedId = String(requestId);
    return requests.find((item) => String(item.id) === normalizedId) || null;
  }

  function normalizeRequest(request) {
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

  function openModal(request) {
    const modal = document.getElementById('request-view-modal');

    if (!modal) {
      return;
    }

    const data = normalizeRequest(request);
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
      status.textContent = STATUS_LABELS[data.status] || data.status || '';
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
      date.textContent = data.createdAt ? formatDate(data.createdAt) : '';
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

    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('profile-modal-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('request-view-modal');

    if (!modal) {
      return;
    }

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('profile-modal-open');

    if (!document.getElementById('request-modal') || !document.getElementById('request-modal').classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
  }

  function resolveTrigger(target) {
    const button = target.closest('[data-request-view-id]');

    if (button) {
      return button;
    }

    if (target.closest('button, a')) {
      return null;
    }

    const card = target.closest('.request-item--viewable');

    if (card) {
      return card.querySelector('[data-request-view-id]');
    }

    return null;
  }

  function bindModal() {
    const modal = document.getElementById('request-view-modal');

    if (!modal || modal.dataset.profileModalBound === 'true') {
      return;
    }

    modal.dataset.profileModalBound = 'true';

    const requests = readProfileRequests();
    const closeButton = modal.querySelector('.request-view-modal__close');

    if (closeButton) {
      closeButton.addEventListener('click', closeModal);
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

    document.addEventListener('click', (event) => {
      const trigger = resolveTrigger(event.target);

      if (!trigger) {
        return;
      }

      const requestId = trigger.getAttribute('data-request-view-id');

      if (!requestId) {
        return;
      }

      const card = trigger.closest('.request-item');
      let request = readRequestFromCard(card) || findRequest(requestId, requests);

      if (!request) {
        const reloaded = readProfileRequests();
        request = findRequest(requestId, reloaded);
      }

      if (!request) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openModal(request);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindModal);
  } else {
    bindModal();
  }
})();
