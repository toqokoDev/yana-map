import { escapeHtml } from '../common/utils.js';

export function buildObjectSearchText(object) {
  return [
    object.title,
    object.address,
    object.category,
    object.subcategory,
    object.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function buildSearchableItems(objects) {
  return (objects || [])
    .filter((object) => object.coordinates)
    .map((object) => ({
      object,
      searchText: buildObjectSearchText(object),
    }));
}

function getObjectSubtitle(object) {
  return object.address || object.subcategory || object.category;
}

function renderMatches(results, matches, onSelect) {
  if (matches.length === 0) {
    results.innerHTML = '<p class="sidebar-search-results__empty">Ничего не найдено</p>';
    return;
  }

  results.innerHTML = matches
    .map(
      (item, index) => `
            <button class="sidebar-search-result" type="button" data-search-index="${index}">
                <strong>${escapeHtml(item.object.title)}</strong>
                <span>${escapeHtml(getObjectSubtitle(item.object))}</span>
            </button>
        `,
    )
    .join('');

  results.querySelectorAll('[data-search-index]').forEach((resultButton) => {
    resultButton.addEventListener('click', () => {
      const item = matches[Number(resultButton.dataset.searchIndex)];
      onSelect(item);
    });
  });
}

/**
 * @param {{
 *   roots: Array<{ input: HTMLInputElement, results: HTMLElement, button?: HTMLButtonElement | null }>,
 *   getSearchableItems: () => Array<{ object: object, searchText: string }>,
 *   onSelect: (item: { object: object }) => void,
 *   onClear: () => void,
 *   isSelected?: (item: { object: object }) => boolean,
 *   restoreFromQuery?: boolean,
 * }} options
 */
function navigateToMapQuery(params) {
  const queryString = params.toString();

  if (window.location.pathname === '/map') {
    window.history.replaceState(
      {},
      '',
      queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname,
    );
    return;
  }

  window.location.href = queryString ? `/map?${queryString}` : '/map';
}

export function attachObjectSearch({
  roots,
  getSearchableItems,
  onSelect,
  onClear,
  isSelected = () => false,
  restoreFromQuery = false,
}) {
  const activeRoots = roots.filter((root) => root.input && root.results);

  if (activeRoots.length === 0) {
    return;
  }

  const syncInputs = (value) => {
    activeRoots.forEach(({ input }) => {
      input.value = value;
    });
  };

  const clearResults = () => {
    activeRoots.forEach(({ results }) => {
      results.innerHTML = '';
    });
  };

  const clearSearchUi = () => {
    syncInputs('');
    clearResults();
  };

  const handleSelect = (item) => {
    if (!item) {
      return;
    }

    if (isSelected(item)) {
      clearSearchUi();
      onClear();
      return;
    }

    clearSearchUi();
    onSelect(item);
  };

  const runSearchForRoot = ({ input, results }) => {
    const query = input.value.trim().toLowerCase();

    if (!query) {
      results.innerHTML = '';
      return;
    }

    const matches = getSearchableItems()
      .filter((item) => item.searchText.includes(query))
      .slice(0, 8);

    renderMatches(results, matches, handleSelect);
  };

  const runSearchAll = () => {
    activeRoots.forEach(runSearchForRoot);
  };

  activeRoots.forEach((root) => {
    const { input, results, button } = root;
    const form = input.closest('form');

    input.addEventListener('input', () => {
      activeRoots.forEach(({ input: otherInput }) => {
        if (otherInput !== input) {
          otherInput.value = input.value;
        }
      });
      runSearchAll();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();

      const firstResult = results.querySelector('[data-search-index]');
      if (firstResult) {
        firstResult.click();
        return;
      }

      const query = input.value.trim();
      if (query) {
        const params = new URLSearchParams();
        params.set('q', query);
        clearSearchUi();
        navigateToMapQuery(params);
      }
    });

    if (button) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        runSearchAll();
      });
    }

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();

        const firstResult = results.querySelector('[data-search-index]');
        if (firstResult) {
          firstResult.click();
          return;
        }

        const query = input.value.trim();
        if (!query) {
          return;
        }

        const params = new URLSearchParams();
        params.set('q', query);
        clearSearchUi();
        navigateToMapQuery(params);
      });
    }
  });

  if (!restoreFromQuery) {
    return { runSearch: runSearchAll };
  }

  const params = new URLSearchParams(window.location.search);
  const objectId = params.get('object');
  const query = params.get('q');

  if (objectId) {
    const item = getSearchableItems().find(
      (searchItem) => String(searchItem.object.id) === objectId,
    );

    if (item) {
      handleSelect(item);
      return { runSearch: runSearchAll };
    }
  }

  if (query) {
    syncInputs(query);
    runSearchAll();
  }

  return { runSearch: runSearchAll };
}
