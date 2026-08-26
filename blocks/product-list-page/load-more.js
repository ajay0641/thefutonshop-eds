import { search } from '@dropins/storefront-product-discovery/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { Button, provider as UI } from '@dropins/tools/components.js';

/**
 * Builds a stable key for sort/filter/phrase changes (resets load-more page).
 * @param {object} request
 */
function getRequestSignature(request) {
  if (!request) return '';
  const filters = (request.filter || []).filter(
    (f) => f.attribute !== 'visibility' && f.attribute !== 'categoryPath',
  );
  return JSON.stringify({
    phrase: request.phrase || '',
    sort: request.sort || [],
    filter: filters,
  });
}

/**
 * Load-more controller for PLP. Fetches additional products by increasing pageSize
 * (page 1) so the stock SearchResults drop-in can render the full accumulated list.
 *
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {() => number} options.getBatchSize Per-page value from the toolbar
 * @param {number} [options.initialLoadMorePage=1] From URL ?p=
 * @param {() => void} [options.onSearchContextChange] Sort/filter changed (reset scroll URL)
 * @param {{ loadMore?: string, loading?: string }} [options.labels]
 */
export function createLoadMoreController({
  container,
  getBatchSize,
  initialLoadMorePage = 1,
  onSearchContextChange,
  labels = {},
}) {
  const loadMoreLabel = labels.loadMore || 'Load Next';
  const loadingLabel = labels.loading || 'Loading...';

  let lastRequest = null;
  let lastSignature = '';
  let totalCount = 0;
  let displayedCount = 0;
  let loading = false;
  let pendingLoadMore = false;
  let loadMorePage = Math.max(1, initialLoadMorePage);
  let savedScrollY = 0;
  let shouldRestoreScroll = false;
  let navigatedViaLoadMore = false;

  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'search__load-more';
  container.append(buttonWrapper);

  /** @type {HTMLButtonElement|null} */
  let buttonEl = null;

  const updateButton = () => {
    const hasMore = displayedCount > 0 && displayedCount < totalCount;
    buttonWrapper.hidden = !hasMore;
    if (!buttonEl) return;
    buttonEl.disabled = loading;
    buttonEl.textContent = loading && pendingLoadMore ? loadingLabel : loadMoreLabel;
  };

  const restoreScroll = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollY, left: 0, behavior: 'auto' });
      });
    });
  };

  const handleLoadMore = async (event) => {
    event?.preventDefault?.();
    if (!lastRequest || loading || displayedCount >= totalCount) return;

    const batchSize = getBatchSize();
    loadMorePage += 1;
    const nextSize = Math.min(batchSize * loadMorePage, totalCount);

    pendingLoadMore = true;
    navigatedViaLoadMore = true;
    shouldRestoreScroll = true;
    loading = true;
    savedScrollY = window.scrollY;
    updateButton();

    try {
      await search({
        ...lastRequest,
        pageSize: nextSize,
        currentPage: 1,
      });
    } catch (error) {
      console.error('PLP load more failed', error);
      loadMorePage = Math.max(1, loadMorePage - 1);
      pendingLoadMore = false;
      navigatedViaLoadMore = false;
      loading = false;
      updateButton();
    }
  };

  const renderButton = () => {
    UI.render(Button, {
      variant: 'secondary',
      disabled: loading,
      onClick: handleLoadMore,
      children: loading && pendingLoadMore ? loadingLabel : loadMoreLabel,
    })(buttonWrapper);
    buttonEl = buttonWrapper.querySelector('button');
    buttonEl?.setAttribute('type', 'button');
    updateButton();
  };

  const loadingSub = events.on('search/loading', (isLoading) => {
    loading = isLoading;
    if (!isLoading) {
      if (shouldRestoreScroll) {
        restoreScroll();
        shouldRestoreScroll = false;
      }
      pendingLoadMore = false;
    }
    updateButton();
  });

  const resultSub = events.on('search/result', (payload) => {
    const signature = getRequestSignature(payload.request);

    if (!pendingLoadMore && signature !== lastSignature && lastSignature !== '') {
      loadMorePage = 1;
      navigatedViaLoadMore = false;
      onSearchContextChange?.();
    }

    lastSignature = signature;
    lastRequest = payload.request;
    totalCount = payload.result?.totalCount ?? 0;
    displayedCount = payload.result?.items?.length ?? 0;
    updateButton();
  }, { eager: true });

  renderButton();

  return {
    getLoadMorePage: () => loadMorePage,
    getLastRequest: () => lastRequest,
    consumeLoadMoreNavigation: () => {
      const wasLoadMore = navigatedViaLoadMore;
      navigatedViaLoadMore = false;
      return wasLoadMore;
    },
    reset: () => {
      loadMorePage = 1;
      navigatedViaLoadMore = false;
    },
    destroy: () => {
      loadingSub?.off?.();
      resultSub?.off?.();
    },
  };
}
