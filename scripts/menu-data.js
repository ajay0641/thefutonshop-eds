import { CS_FETCH_GRAPHQL } from './commerce.js';

const MENU_SESSION_PREFIX = 'hlx-menu-categories-v3';

const GET_MENU_QUERY = `
  query GetMenuCategories(
    $ids: [String!]!
    $roles: [String!]!
    $depth: Int!
    $startLevel: Int!
  ) {
    categories(
      ids: $ids
      roles: $roles
      subtree: {
        depth: $depth
        startLevel: $startLevel
      }
    ) {
      id
      name
      level
      urlPath
      urlKey
      parentId
      position
      children
    }
  }
`;

/** @type {Map<string, Promise<import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]>>} */
const menuCache = new Map();

/** @type {Map<string, () => Promise<import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]>>} */
const menuFetchers = new Map();

/**
 * @param {string} parentId
 * @returns {string}
 */
function getSessionKey(parentId) {
  return `${MENU_SESSION_PREFIX}:${parentId}`;
}

/**
 * @param {string} parentId
 * @returns {import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]|null}
 */
function readMenuFromSession(parentId) {
  try {
    sessionStorage.removeItem(`hlx-menu-categories:${parentId}`);
    sessionStorage.removeItem(`hlx-menu-categories-v2:${parentId}`);
    const stored = sessionStorage.getItem(getSessionKey(parentId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} parentId
 * @param {import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]} categories
 */
function writeMenuToSession(parentId, categories) {
  try {
    sessionStorage.setItem(getSessionKey(parentId), JSON.stringify(categories));
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Reorders the flat category list so MenuContainer preserves sibling order from the API.
 * Catalog Service defines order via each parent's `children` array and `position` field;
 * the flat `categories` array order is not guaranteed.
 * @param {import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]} categories
 * @param {string} rootId
 * @returns {import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]}
 */
function orderCategoriesForMenu(categories, rootId) {
  if (!categories?.length) return [];

  const byId = new Map(categories.map((category) => [String(category.id), category]));
  /** @type {import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]} */
  const ordered = [];
  const visited = new Set();

  /**
   * @param {string} parentId
   */
  function appendChildren(parentId) {
    const parent = byId.get(String(parentId));
    /** @type {string[]} */
    let childIds = [];

    if (parent?.children?.length) {
      childIds = parent.children.map(String);
    } else {
      childIds = categories
        .filter((category) => String(category.parentId) === String(parentId))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((category) => String(category.id));
    }

    childIds.forEach((id) => {
      if (visited.has(id)) return;

      const category = byId.get(id);
      if (!category) return;

      visited.add(id);
      ordered.push(category);
      appendChildren(id);
    });
  }

  appendChildren(rootId);

  categories.forEach((category) => {
    const id = String(category.id);
    if (!visited.has(id)) {
      ordered.push(category);
    }
  });

  return ordered;
}

/**
 * Loads menu categories directly from Catalog Service (API response order).
 * Uses a dedicated query so product blocks on the homepage cannot pollute the menu cache.
 * @param {string} parentId
 * @returns {Promise<import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]>}
 */
async function loadMenuCategoriesFromApi(parentId) {
  await import('./initializers/menu.js');

  const { data, errors } = await CS_FETCH_GRAPHQL.fetchGraphQl(GET_MENU_QUERY, {
    method: 'POST',
    variables: {
      ids: [parentId],
      roles: ['show_in_menu', 'active'],
      depth: 3,
      startLevel: 1,
    },
  });

  if (errors?.length) {
    throw new Error(errors[0].message);
  }

  return orderCategoriesForMenu(data?.categories || [], parentId);
}

/**
 * Fetches menu categories in API response order and caches for the session.
 * @param {string} [parentId='2']
 * @returns {Promise<import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]>}
 */
export function fetchMenuCategories(parentId = '2') {
  const cacheKey = String(parentId);
  if (menuCache.has(cacheKey)) {
    return menuCache.get(cacheKey);
  }

  const cached = readMenuFromSession(cacheKey);
  if (cached) {
    const resolved = Promise.resolve(cached);
    menuCache.set(cacheKey, resolved);
    return resolved;
  }

  const promise = loadMenuCategoriesFromApi(cacheKey).then((categories) => {
    writeMenuToSession(cacheKey, categories);
    return categories;
  });

  menuCache.set(cacheKey, promise);
  return promise;
}

/**
 * Stable fetchCategories callback for MenuContainer (avoids useEffect re-fetch loops).
 * @param {string} [parentId='2']
 * @returns {() => Promise<import('@ajay0641/tfs-menu/api/menu/menu').CategoryItem[]>>}
 */
export function getMenuCategoriesFetcher(parentId = '2') {
  const cacheKey = String(parentId);
  if (!menuFetchers.has(cacheKey)) {
    menuFetchers.set(cacheKey, () => fetchMenuCategories(cacheKey));
  }
  return menuFetchers.get(cacheKey);
}

/**
 * Warms the menu cache after commerce is initialized.
 * Must run before page blocks that issue their own categories queries.
 * @param {string} [parentId='2']
 * @returns {Promise<void>}
 */
export async function prefetchMenuCategories(parentId = '2') {
  await fetchMenuCategories(parentId).catch(() => {});
}
