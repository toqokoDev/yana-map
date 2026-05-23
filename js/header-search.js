import { api } from './common/api.js';
import {
  attachObjectSearch,
  buildSearchableItems,
} from './map/object-search-ui.js';

async function initHeaderSearch() {
  if (document.getElementById('map')) {
    return;
  }

  const input = document.querySelector('.search-form__input');
  const results = document.getElementById('header-search-results');
  const button = document.querySelector('.search-form__button');

  if (!input || !results) {
    return;
  }

  try {
    const mapData = await api.getMapData();
    const searchableItems = buildSearchableItems(mapData.objects);

    attachObjectSearch({
      roots: [{ input, results, button }],
      getSearchableItems: () => searchableItems,
      onSelect: (item) => {
        const params = new URLSearchParams();
        params.set('object', item.object.id);
        params.set('q', item.object.title);
        window.location.href = `/map?${params.toString()}`;
      },
      onClear: () => {},
    });
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initHeaderSearch();
});
