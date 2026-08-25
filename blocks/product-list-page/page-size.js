import { getPerPageConfigForView } from './store-config.js';

export const PLP_PAGE_LIMIT_STORAGE_PREFIX = 'plp-page-limit';

/**
 * @param {'grid' | 'list'} viewMode
 * @returns {string}
 */
function getStorageKey(viewMode) {
  return `${PLP_PAGE_LIMIT_STORAGE_PREFIX}:${viewMode}`;
}

/**
 * @param {'grid' | 'list'} viewMode
 * @param {number} value
 */
function savePageLimit(viewMode, value) {
  localStorage.setItem(getStorageKey(viewMode), String(value));
}

/**
 * @param {'grid' | 'list'} viewMode
 * @returns {number|null}
 */
function getSavedPageLimit(viewMode) {
  const saved = localStorage.getItem(getStorageKey(viewMode));
  if (!saved) return null;
  const parsed = parseInt(saved, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resolves the active page size for a view mode.
 * @param {object} options
 * @param {object} options.storeConfig
 * @param {'grid' | 'list'} options.viewMode
 * @param {number|null} [options.urlLimit]
 * @returns {number}
 */
export function resolvePageSize({ storeConfig, viewMode, urlLimit = null }) {
  const { defaultValue, values } = getPerPageConfigForView(storeConfig, viewMode);

  if (urlLimit && values.includes(urlLimit)) {
    return urlLimit;
  }

  const saved = getSavedPageLimit(viewMode);
  if (saved && values.includes(saved)) {
    return saved;
  }

  return defaultValue;
}

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.storeConfig
 * @param {() => 'grid' | 'list'} options.getViewMode
 * @param {number} options.initialPageSize
 * @param {object} [options.labels]
 * @param {(pageSize: number) => void} options.onPageSizeChange
 * @returns {{ setPageSize: (pageSize: number) => void, syncToViewMode: () => number }}
 */
export function createPageSizeController({
  container,
  storeConfig,
  getViewMode,
  initialPageSize,
  labels = {},
  onPageSizeChange,
}) {
  const showLabel = labels.show || 'Show';
  const perPageLabel = labels.perPage || 'per page';

  const wrapper = document.createElement('div');
  wrapper.className = 'search__page-size';

  const label = document.createElement('label');
  label.className = 'search__page-size-label';
  label.setAttribute('for', 'plp-page-size-select');

  const select = document.createElement('select');
  select.id = 'plp-page-size-select';
  select.className = 'search__page-size-select';
  select.setAttribute('aria-label', `${showLabel} ${perPageLabel}`);

  label.append(showLabel, ' ', select, ` ${perPageLabel}`);
  wrapper.append(label);
  container.append(wrapper);

  let currentPageSize = initialPageSize;

  const populateOptions = (viewMode, selectedValue) => {
    const { values } = getPerPageConfigForView(storeConfig, viewMode);
    select.innerHTML = '';
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      if (value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  };

  const setPageSize = (pageSize, persist = false) => {
    const viewMode = getViewMode();
    const { values } = getPerPageConfigForView(storeConfig, viewMode);
    const nextSize = values.includes(pageSize) ? pageSize : values[0];
    currentPageSize = nextSize;
    populateOptions(viewMode, nextSize);
    if (persist) {
      savePageLimit(viewMode, nextSize);
    }
  };

  const syncToViewMode = () => {
    const viewMode = getViewMode();
    const nextSize = resolvePageSize({
      storeConfig,
      viewMode,
      urlLimit: null,
    });
    setPageSize(nextSize);
    return nextSize;
  };

  populateOptions(getViewMode(), initialPageSize);

  select.addEventListener('change', () => {
    const nextSize = parseInt(select.value, 10);
    if (!Number.isFinite(nextSize) || nextSize === currentPageSize) return;
    setPageSize(nextSize, true);
    onPageSizeChange(nextSize);
  });

  return { setPageSize, syncToViewMode, getPageSize: () => currentPageSize };
}
