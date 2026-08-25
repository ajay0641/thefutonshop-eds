const COLLAPSED_CLASS = 'product-discovery-facet--collapsed';

/**
 * @param {HTMLElement} facet
 */
function toggleFacet(facet) {
  const collapsed = facet.classList.toggle(COLLAPSED_CLASS);
  const header = facet.querySelector('.product-discovery-facet__header');
  header?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
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
    if (facet) toggleFacet(facet);
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const header = event.target.closest('.product-discovery-facet__header');
    if (!header || !container.contains(header)) return;

    event.preventDefault();
    const facet = header.closest('.product-discovery-facet');
    if (facet) toggleFacet(facet);
  });
}
