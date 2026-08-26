import { applySearchStateToUrl } from './search-url.js';

/**
 * Updates ?p= in the URL based on which product batch is visible while scrolling.
 * Page 1 → no param; page 2+ → ?p=N
 *
 * @param {object} options
 * @param {HTMLElement} options.productListRoot `.search__product-list` element
 * @param {() => number} options.getBatchSize Per-page batch size
 * @param {() => object|null} options.getLastRequest Latest search request (for sort/filter/q)
 * @param {() => URL} options.buildUrl Canonical URL builder
 */
export function createScrollPageUrlSync({
  productListRoot,
  getBatchSize,
  getLastRequest,
  buildUrl,
}) {
  let visiblePage = 1;
  /** @type {number} */
  let rafId = 0;
  /** @type {MutationObserver|null} */
  let mutationObserver = null;

  const syncUrl = (page) => {
    const nextPage = Math.max(1, page);
    const request = getLastRequest();
    if (!request) return;

    const url = buildUrl();
    applySearchStateToUrl(url, request, { loadMorePage: nextPage });

    if (url.href !== window.location.href) {
      window.history.replaceState({}, '', url.toString());
    }

    visiblePage = nextPage;
  };

  const measureVisiblePage = () => {
    const grid = productListRoot.querySelector('.product-discovery-product-list__grid');
    if (!grid) return 1;

    const cards = grid.querySelectorAll('.dropin-product-item-card');
    const batchSize = getBatchSize();
    if (!cards.length || batchSize <= 0) return 1;

    const triggerLine = Math.min(window.innerHeight * 0.35, 280);
    let page = 1;
    const totalPages = Math.ceil(cards.length / batchSize);

    for (let p = 2; p <= totalPages; p += 1) {
      const marker = cards[(p - 1) * batchSize];
      if (!marker) break;
      if (marker.getBoundingClientRect().top <= triggerLine) {
        page = p;
      }
    }

    return page;
  };

  const scheduleUpdate = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const page = measureVisiblePage();
      if (page !== visiblePage) {
        syncUrl(page);
      }
    });
  };

  const onScroll = () => scheduleUpdate();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  mutationObserver = new MutationObserver(scheduleUpdate);
  mutationObserver.observe(productListRoot, { childList: true, subtree: true });

  return {
    getVisiblePage: () => visiblePage,
    refresh: scheduleUpdate,
    measureNow: () => {
      const page = measureVisiblePage();
      if (page !== visiblePage) {
        syncUrl(page);
      }
      return visiblePage;
    },
    reset: () => {
      if (visiblePage !== 1) {
        syncUrl(1);
      }
    },
    destroy: () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mutationObserver?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
