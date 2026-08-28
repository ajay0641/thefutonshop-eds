const COLLAPSED_CLASS = 'product-discovery-facet--collapsed';

/** @type {WeakMap<HTMLElement, Map<string, boolean>>} */
const facetStateByContainer = new WeakMap();

/**
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFacetGroups(container) {
  const facetOptions = container.querySelector('.product-discovery-facet-list__facet-options');
  if (facetOptions) {
    return [...facetOptions.querySelectorAll('.product-discovery-facet')];
  }

  return [...container.querySelectorAll('.product-discovery-facet')].filter(
    (facet) => !facet.closest('.product-discovery-facet-list__selected-filters'),
  );
}

/**
 * @param {HTMLElement} facet
 * @returns {string}
 */
function getFacetKey(facet) {
  return facet.querySelector('.product-discovery-facet__header')?.textContent?.trim() || '';
}

/**
 * @param {HTMLElement} container
 * @returns {Map<string, boolean>}
 */
function getStateMap(container) {
  if (!facetStateByContainer.has(container)) {
    facetStateByContainer.set(container, new Map());
  }
  return facetStateByContainer.get(container);
}

/**
 * @param {HTMLElement} facet
 * @param {boolean} isOpen
 */
function setFacetOpen(facet, isOpen) {
  facet.classList.toggle(COLLAPSED_CLASS, !isOpen);
  const header = facet.querySelector('.product-discovery-facet__header');
  header?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

/**
 * @param {HTMLElement} facet
 * @param {HTMLElement} container
 */
function saveFacetState(facet, container) {
  const key = getFacetKey(facet);
  if (!key) return;
  getStateMap(container).set(key, !facet.classList.contains(COLLAPSED_CLASS));
}

/**
 * Restores saved accordion state after facet re-renders.
 * On first load only the first facet group is open by default.
 * @param {HTMLElement} container
 */
function restoreFacetState(container) {
  const facets = getFacetGroups(container);
  const stateMap = getStateMap(container);
  const isInitial = stateMap.size === 0;

  facets.forEach((facet, index) => {
    const key = getFacetKey(facet);
    if (!key) return;

    let isOpen;
    if (stateMap.has(key)) {
      isOpen = stateMap.get(key);
    } else if (isInitial) {
      isOpen = index === 0;
    } else {
      isOpen = false;
    }

    setFacetOpen(facet, isOpen);
    stateMap.set(key, isOpen);
  });
}

/**
 * @param {HTMLElement} facet
 * @param {HTMLElement} container
 */
function toggleFacet(facet, container) {
  facet.classList.toggle(COLLAPSED_CLASS);
  const header = facet.querySelector('.product-discovery-facet__header');
  const isOpen = !facet.classList.contains(COLLAPSED_CLASS);
  header?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  saveFacetState(facet, container);
}

/**
 * @param {HTMLElement} header
 */
function enhanceFacetHeader(header) {
  if (header.dataset.accordionEnhanced) return;

  header.dataset.accordionEnhanced = 'true';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');

  const facet = header.closest('.product-discovery-facet');
  const collapsed = facet?.classList.contains(COLLAPSED_CLASS);
  header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

/**
 * @param {HTMLElement} container
 */
function enhanceFacetHeaders(container) {
  restoreFacetState(container);
  container.querySelectorAll('.product-discovery-facet__header').forEach(enhanceFacetHeader);
}

/**
 * Enables accordion expand/collapse for product-discovery facet groups.
 * Uses event delegation so it keeps working when facets re-render after search.
 * @param {HTMLElement} container
 */
export function initFacetAccordions(container) {
  if (!container || container.dataset.facetAccordionInit) return;

  container.dataset.facetAccordionInit = 'true';
  enhanceFacetHeaders(container);

  const observer = new MutationObserver(() => enhanceFacetHeaders(container));
  observer.observe(container, { childList: true, subtree: true });

  container.addEventListener('click', (event) => {
    const header = event.target.closest('.product-discovery-facet__header');
    if (!header || !container.contains(header)) return;

    const facet = header.closest('.product-discovery-facet');
    if (facet) toggleFacet(facet, container);
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const header = event.target.closest('.product-discovery-facet__header');
    if (!header || !container.contains(header)) return;

    event.preventDefault();
    const facet = header.closest('.product-discovery-facet');
    if (facet) toggleFacet(facet, container);
  });
}
