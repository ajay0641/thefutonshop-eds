import { fetchPlpStoreConfig } from './store-config.js';

export const PLP_VIEW_MODE_STORAGE_KEY = 'plp-view-mode';
export const PLP_VIEW_MODE_CONFIG_KEY = 'plp-view-mode-admin-config';

/** @deprecated Use fetchPlpStoreConfig from store-config.js */
export async function fetchStoreListMode() {
  const config = await fetchPlpStoreConfig();
  return config.listMode;
}

/**
 * Parses Magento list_mode into default view and toggle visibility.
 * @param {string} listMode
 * @returns {{ defaultView: 'grid' | 'list', showToggle: boolean }}
 */
export function parseListMode(listMode) {
  const normalized = (listMode || 'grid').toLowerCase();

  if (normalized === 'grid' || normalized === 'list') {
    return {
      defaultView: normalized,
      showToggle: false,
    };
  }

  const [first] = normalized.split('-');
  return {
    defaultView: first === 'list' ? 'list' : 'grid',
    showToggle: normalized.includes('-'),
  };
}

/**
 * @param {object} options
 * @param {string} options.iconBasePath
 * @param {string} options.viewAsLabel
 * @param {string} options.gridLabel
 * @param {string} options.listLabel
 * @returns {string}
 */
export function getLayoutToggleMarkup({
  iconBasePath,
  _viewAsLabel,
  gridLabel,
  listLabel,
}) {
  const iconUrl = (name) => `${iconBasePath}/icons/${name}.svg`;

  return `
    <button type="button" class="search__layout-toggle search__layout-toggle--grid" aria-label="${gridLabel}" aria-pressed="false">
      <img class="search__layout-toggle__icon search__layout-toggle__icon--default" src="${iconUrl('grid')}" width="25" height="24" alt="" aria-hidden="true" />
      <img class="search__layout-toggle__icon search__layout-toggle__icon--active" src="${iconUrl('grid-active')}" width="26" height="26" alt="" aria-hidden="true" />
    </button>
    <button type="button" class="search__layout-toggle search__layout-toggle--list" aria-label="${listLabel}" aria-pressed="false">
      <img class="search__layout-toggle__icon search__layout-toggle__icon--default" src="${iconUrl('list')}" width="26" height="26" alt="" aria-hidden="true" />
      <img class="search__layout-toggle__icon search__layout-toggle__icon--active" src="${iconUrl('list-active')}" width="26" height="26" alt="" aria-hidden="true" />
    </button>
  `;
}

/**
 * Wires grid/list view mode from admin config and optional shopper toggle.
 * @param {object} options
 * @param {HTMLElement} options.block
 * @param {{ defaultView: 'grid' | 'list', showToggle: boolean }} options.listModeConfig
 * @param {string} options.storeListMode Raw admin list_mode value
 * @param {object} [options.labels]
 * @param {(view: 'grid' | 'list') => void} [options.onViewModeChange]
 * @returns {{
 *   setViewMode: (view: 'grid' | 'list') => void,
 *   mountToggles: (container: HTMLElement) => void
 * }}
 */
export function createViewModeController({
  block,
  listModeConfig,
  storeListMode,
  labels = {},
  onViewModeChange,
}) {
  const { defaultView, showToggle } = listModeConfig;
  const toggleLabels = {
    viewAs: labels.viewAs || 'View as',
    grid: labels.grid || 'Grid',
    list: labels.list || 'List',
  };

  const getInitialView = () => {
    if (!showToggle) return defaultView;

    const savedConfig = localStorage.getItem(PLP_VIEW_MODE_CONFIG_KEY);
    const savedView = localStorage.getItem(PLP_VIEW_MODE_STORAGE_KEY);

    // Only reuse shopper preference when admin list_mode has not changed.
    if (savedConfig === storeListMode && (savedView === 'grid' || savedView === 'list')) {
      return savedView;
    }

    return defaultView;
  };

  const setViewMode = (view) => {
    if (showToggle) {
      localStorage.setItem(PLP_VIEW_MODE_STORAGE_KEY, view);
      localStorage.setItem(PLP_VIEW_MODE_CONFIG_KEY, storeListMode);
    }

    block.classList.toggle('list-view', view === 'list');
    block.dataset.viewMode = view;

    block.querySelectorAll('.search__layout-toggle').forEach((button) => {
      const isActive = button.classList.contains(`search__layout-toggle--${view}`);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    onViewModeChange?.(view);
  };

  const mountToggles = (container) => {
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', toggleLabels.viewAs);
    container.insertAdjacentHTML('beforeend', getLayoutToggleMarkup({
      iconBasePath: window.hlx?.codeBasePath || '',
      ...toggleLabels,
    }));
    container.querySelector('.search__layout-toggle--grid')
      ?.addEventListener('click', () => setViewMode('grid'));
    container.querySelector('.search__layout-toggle--list')
      ?.addEventListener('click', () => setViewMode('list'));
  };

  setViewMode(getInitialView());

  return { setViewMode, mountToggles };
}
