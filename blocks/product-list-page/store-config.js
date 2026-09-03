import { CS_FETCH_GRAPHQL } from '../../scripts/commerce.js';

const PLP_STORE_CONFIG_QUERY = `
  query PlpStoreConfig {
    storeConfig {
      list_mode
      grid_per_page
      grid_per_page_values
      list_per_page
      list_per_page_values
    }
  }
`;

/**
 * @param {string} [values]
 * @param {number[]} fallback
 * @returns {number[]}
 */
function parsePerPageValues(values, fallback) {
  const parsed = (values || '')
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return parsed.length ? parsed : fallback;
}

/**
 * @param {object} config
 * @param {'grid' | 'list'} viewMode
 * @returns {{ defaultValue: number, values: number[] }}
 */
export function getPerPageConfigForView(config, viewMode) {
  if (viewMode === 'list') {
    const values = parsePerPageValues(config.listPerPageValues, [10]);
    const defaultValue = config.listPerPage || values[0] || 10;
    return {
      defaultValue: values.includes(defaultValue) ? defaultValue : values[0],
      values,
    };
  }

  const values = parsePerPageValues(config.gridPerPageValues, [12]);
  const defaultValue = config.gridPerPage || values[0] || 12;
  return {
    defaultValue: values.includes(defaultValue) ? defaultValue : values[0],
    values,
  };
}

export const DEFAULT_PLP_STORE_CONFIG = {
  listMode: 'grid',
  gridPerPage: 12,
  gridPerPageValues: '12,24,36',
  listPerPage: 10,
  listPerPageValues: '5,10,15,20,25',
};

/**
 * Fetches PLP-related Magento admin store configuration.
 * @returns {Promise<{
 *   listMode: string,
 *   gridPerPage: number,
 *   gridPerPageValues: string,
 *   listPerPage: number,
 *   listPerPageValues: string
 * }>}
 */
export async function fetchPlpStoreConfig() {
  const fallback = DEFAULT_PLP_STORE_CONFIG;

  try {
    const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(PLP_STORE_CONFIG_QUERY, {
      method: 'GET',
      cache: 'no-cache',
    });
    const storeConfig = data?.storeConfig || {};

    return {
      listMode: storeConfig.list_mode || fallback.listMode,
      gridPerPage: storeConfig.grid_per_page || fallback.gridPerPage,
      gridPerPageValues: storeConfig.grid_per_page_values || fallback.gridPerPageValues,
      listPerPage: storeConfig.list_per_page || fallback.listPerPage,
      listPerPageValues: storeConfig.list_per_page_values || fallback.listPerPageValues,
    };
  } catch (error) {
    console.warn('Failed to fetch PLP store config', error);
    return fallback;
  }
}
