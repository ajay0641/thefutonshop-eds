// Product Discovery Dropins
import Facets from '@dropins/storefront-product-discovery/containers/Facets.js';
import SortBy from '@dropins/storefront-product-discovery/containers/SortBy.js';
import { render as provider } from '@dropins/storefront-product-discovery/render.js';
import { search } from '@dropins/storefront-product-discovery/api.js';
import { Button, Icon, provider as UI } from '@dropins/tools/components.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
// Event Bus
import { events } from '@dropins/tools/event-bus.js';
import PlpSearchResults from './plp-search-results.js';
// AEM
import { readBlockConfig } from '../../scripts/aem.js';
import {
  CS_FETCH_GRAPHQL,
  canonicalizeCategoryUrl,
  fetchPlaceholders,
  getCategoryFromUrl,
  getProductLink,
  IS_DA,
  IS_UE,
  isCategoryTemplate,
  shouldCanonicalizeCategoryUrl,
} from '../../scripts/commerce.js';
import { getCategoryAncestors } from '../../scripts/menu-data.js';
import { withProductImageFallback } from '../../scripts/product-image.js';
import { getSearchStateFromUrl, applySearchStateToUrl } from './search-url.js';
import {
  createViewModeController,
  parseListMode,
} from './view-mode.js';
import { initFacetAccordions } from './facet-accordion.js';
import { renderPriceRangeFacetSlot } from './price-range-slider.js';
import {
  DEFAULT_PLP_STORE_CONFIG,
  fetchPlpStoreConfig,
  getPerPageConfigForView,
} from './store-config.js';
import { createPageSizeController, resolvePageSize } from './page-size.js';
import { createLoadMoreController } from './load-more.js';
import { createScrollPageUrlSync } from './scroll-page-url.js';
import { createProductCardSlots } from '../../scripts/product-card.js';
import {
  createTfsProductCardHandlers,
  requiresTfsPdpConfiguration,
} from '../../scripts/tfs-product-card-handlers.js';
import { fetchCategoryDetails } from './category-details.js';

// Initializers
import '../../scripts/initializers/search.js';

/** Default PLP card image size (matches Product Discovery SearchResults defaults). */
const PLP_IMAGE_DIMENSIONS = {
  width: 400,
  height: 450,
};

/**
 * Resolves catalog urlPath for template preview in DA/UE when only defaultCateId is authored.
 * @param {string} categoryId Catalog category ID from block config
 * @returns {Promise<string|null>} Category urlPath or null
 */
async function resolveUrlPathFromCategoryId(categoryId) {
  if (!categoryId) return null;

  const query = `
    query ResolveCategoryUrlPath($ids: [String!]!) {
      categories(ids: $ids, roles: ["active"]) {
        urlPath
      }
    }
  `;

  try {
    const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: { ids: [categoryId] },
    });
    return data?.categories?.[0]?.urlPath || null;
  } catch (error) {
    console.warn('Failed to resolve category urlPath for template preview', error);
    return null;
  }
}

export default async function decorate(block) {
  const labels = await fetchPlaceholders();
  let storeConfig = DEFAULT_PLP_STORE_CONFIG;
  const storeConfigPromise = fetchPlpStoreConfig().catch(() => DEFAULT_PLP_STORE_CONFIG);
  const listModeConfig = parseListMode(storeConfig.listMode);
  const storeListMode = storeConfig.listMode;

  const config = readBlockConfig(block);
  const categoryMeta = getCategoryFromUrl();

  let currentPageSize;
  /** @type {ReturnType<typeof createPageSizeController>|null} */
  let pageSizeController = null;
  /** @type {ReturnType<typeof createLoadMoreController>|null} */
  let loadMoreController = null;
  /** @type {ReturnType<typeof createScrollPageUrlSync>|null} */
  let scrollPageUrlSync = null;
  /** @type {(overrides?: object) => Promise<void>} */
  let runSearch;

  const viewModeController = createViewModeController({
    block,
    listModeConfig,
    storeListMode,
    onViewModeChange: () => {
      if (!pageSizeController) return;
      const nextSize = pageSizeController.syncToViewMode();
      if (nextSize !== currentPageSize) {
        currentPageSize = nextSize;
        loadMoreController?.reset();
        scrollPageUrlSync?.reset();
        runSearch({ pageSize: nextSize });
      }
    },
  });

  const getViewMode = () => block.dataset.viewMode || listModeConfig.defaultView;
  const getDefaultPageSize = () => getPerPageConfigForView(storeConfig, getViewMode()).defaultValue;

  // Override authored urlpath with the category from the live URL (folder mapping).
  const urlCategoryPath = categoryMeta?.urlPath;
  if (urlCategoryPath) {
    config.urlpath = urlCategoryPath;
  } else if (!config.urlpath && config.defaultcateid && isCategoryTemplate() && (IS_UE || IS_DA)) {
    const resolvedPath = await resolveUrlPathFromCategoryId(config.defaultcateid);
    if (resolvedPath) {
      config.urlpath = resolvedPath;
    }
  }

  const fragment = document.createRange().createContextualFragment(`
    <div class="search__wrapper">
      <div class="search__result-info"></div>
      <div class="search__view-facets"></div>
      <div class="search__facets"></div>
      <div class="search__product-sort"></div>
      <div class="search__product-list"></div>
      <div class="search__pagination"></div>
    </div>
  `);

  const $resultInfo = fragment.querySelector('.search__result-info');
  const $viewFacets = fragment.querySelector('.search__view-facets');
  const $facets = fragment.querySelector('.search__facets');
  const $productSort = fragment.querySelector('.search__product-sort');
  const $productList = fragment.querySelector('.search__product-list');
  const $pagination = fragment.querySelector('.search__pagination');

  block.innerHTML = '';
  block.appendChild(fragment);

  // Title + banner live before .product-list-page-wrapper so the image can go full-bleed.
  const plpWrapper = block.parentElement;
  let $categoryHero = plpWrapper?.previousElementSibling;
  if (!$categoryHero?.classList.contains('category-hero')) {
    $categoryHero = document.createElement('div');
    $categoryHero.className = 'category-hero';
    $categoryHero.innerHTML = `
      <div class="search__category-title"></div>
      <div class="search__category-image"></div>
    `;
    plpWrapper?.before($categoryHero);
  }

  const $categoryTitle = $categoryHero.querySelector('.search__category-title');
  const $categoryImage = $categoryHero.querySelector('.search__category-image');

  const renderCategoryHeading = (name) => {
    if (!name || !$categoryTitle) return;
    let heading = $categoryTitle.querySelector('h1');
    if (!heading) {
      heading = document.createElement('h1');
      $categoryTitle.append(heading);
    }
    heading.textContent = name;
  };

  /**
   * Renders category banner image under the H1 (full-bleed outside PLP wrapper).
   * @param {{ url: string, label: string }|null} image
   */
  const renderCategoryImage = (image) => {
    if (!$categoryImage) return;
    $categoryImage.innerHTML = '';
    if (!image?.url) return;

    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.label || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    picture.append(img);
    $categoryImage.append(picture);
  };

  /**
   * Renders Magento category description below the PLP wrapper.
   * @param {string|null} descriptionHtml
   */
  const renderCategoryDescription = (descriptionHtml) => {
    if (!plpWrapper) return;

    let $description = plpWrapper.parentElement
      ?.querySelector(':scope > .category-description');
    if (!$description) {
      $description = document.createElement('div');
      $description.className = 'category-description';
      plpWrapper.after($description);
    }

    const html = (descriptionHtml || '').trim();
    if (!html) {
      $description.remove();
      return;
    }

    $description.innerHTML = html;
  };

  if (config.urlpath) {
    // Prefer Catalog Service categoryTree for name/image/description (non-blocking).
    window.setTimeout(() => {
      fetchCategoryDetails(config.urlpath)
        .then((details) => {
          if (!details) {
            getCategoryAncestors(config.urlpath)
              .then((ancestors) => renderCategoryHeading(ancestors.at(-1)?.name || null))
              .catch(() => {});
            return;
          }
          renderCategoryHeading(details.name);
          renderCategoryImage(details.image);
          renderCategoryDescription(details.description);
        })
        .catch(() => {
          getCategoryAncestors(config.urlpath)
            .then((ancestors) => renderCategoryHeading(ancestors.at(-1)?.name || null))
            .catch(() => {});
        });
    }, 0);
  }

  // Add url path back to the block for enrichment, incase enrichment block is
  // executed after the plp block and block config is not available
  if (config.urlpath) {
    block.dataset.urlpath = config.urlpath;
  }
  if (categoryMeta?.cateId) {
    block.dataset.categoryId = categoryMeta.cateId;
  }

  const searchState = getSearchStateFromUrl(new URL(window.location.href));
  const initialLoadMorePage = Math.max(1, searchState.loadMorePage || 1);
  currentPageSize = resolvePageSize({
    storeConfig,
    viewMode: getViewMode(),
    urlLimit: searchState.pageSize,
  }) || parseInt(config.pagesize, 10) || getDefaultPageSize();

  runSearch = async (overrides = {}) => {
    const urlState = getSearchStateFromUrl(new URL(window.location.href));
    const pageSize = overrides.pageSize ?? currentPageSize;
    const sort = overrides.sort ?? (urlState.sort.length
      ? urlState.sort
      : [{ attribute: 'position', direction: 'DESC' }]);
    const filter = overrides.filter ?? urlState.filter.filter((f) => f.attribute !== 'visibility');
    const phrase = overrides.phrase ?? urlState.phrase;

    currentPageSize = pageSize;

    const visibilityFilter = { attribute: 'visibility', in: ['Search', 'Catalog, Search'] };
    const request = {
      phrase,
      currentPage: 1,
      pageSize,
      sort,
      filter: [visibilityFilter, ...filter],
    };

    if (config.urlpath) {
      request.phrase = '';
      request.filter = [
        { attribute: 'categoryPath', eq: config.urlpath },
        ...request.filter,
      ];
    }

    await search(request).catch((error) => {
      console.error('Error searching for products', error);
    });
  };

  const initialUrlState = { ...searchState, pageSize: currentPageSize };

  // Normalize URL if scripts.js has not already canonicalized it
  let normalizedUrl = new URL(window.location.href);
  if (shouldCanonicalizeCategoryUrl(normalizedUrl, categoryMeta)) {
    normalizedUrl = canonicalizeCategoryUrl(normalizedUrl, categoryMeta);
    applySearchStateToUrl(normalizedUrl, initialUrlState, {
      loadMorePage: initialLoadMorePage,
    });
    window.history.replaceState({}, '', normalizedUrl.toString());
  } else {
    applySearchStateToUrl(normalizedUrl, initialUrlState, {
      loadMorePage: initialLoadMorePage,
    });
    if (normalizedUrl.href !== window.location.href) {
      window.history.replaceState({}, '', normalizedUrl.toString());
    }
  }

  // Start product search immediately; do not wait for store-config / menu GraphQL.
  const initialFetchSize = currentPageSize * initialLoadMorePage;
  if (config.urlpath) {
    runSearch({ pageSize: initialFetchSize });
  } else {
    runSearch({ pageSize: initialFetchSize, phrase: searchState.phrase });
  }

  const requiresPdpConfiguration = requiresTfsPdpConfiguration;
  const defaultCardHandlers = {
    onAddToCartClick: async () => {},
    onWishlistClick: async () => {},
    resyncWishlist: () => {},
  };
  let cardHandlers = defaultCardHandlers;

  // Defer cart/wishlist init so it does not compete with productSearch.
  window.setTimeout(() => {
    createTfsProductCardHandlers(block)
      .then((handlers) => {
        cardHandlers = handlers;
        window.requestAnimationFrame(() => cardHandlers.resyncWishlist());
      })
      .catch((error) => {
        console.warn('PLP card handlers failed to initialize', error);
      });
  }, 0);

  const productCardLabels = {
    fromLabel: labels.Search?.From || 'From:',
    saveLabel: labels.Search?.SaveUpTo || 'Save up to {percent}%',
    reviewsLabel: labels.Search?.Reviews || '{count} Reviews',
    reviewLabel: labels.Search?.Review || '{count} Review',
    addToCartLabel: labels.Global?.AddProductToCart || 'Add to cart',
    addToWishlistLabel: labels.Global?.AddToWishList || 'Add to wish list',
  };

  const productCardSlots = createProductCardSlots({
    routeProduct: (product) => getProductLink(product.urlKey, product.sku),
    labels: productCardLabels,
    requiresPdpConfiguration,
    onAddToCartClick: (product, button) => cardHandlers.onAddToCartClick(product, button),
    onWishlistClick: (product, button) => cardHandlers.onWishlistClick(product, button),
    renderProductImage: (ctx) => {
      const {
        product, defaultImageProps, replaceWith,
      } = ctx;
      const width = defaultImageProps.width || PLP_IMAGE_DIMENSIONS.width;
      const height = defaultImageProps.height || PLP_IMAGE_DIMENSIONS.height;
      const anchorWrapper = document.createElement('a');
      anchorWrapper.href = getProductLink(product.urlKey, product.sku);
      anchorWrapper.setAttribute('aria-label', product.name || product.sku);

      const imageProps = withProductImageFallback(defaultImageProps, product);

      tryRenderAemAssetsImage(
        { replaceWith },
        {
          alias: product.sku,
          imageProps: {
            ...imageProps,
            width,
            height,
            params: { ...imageProps.params, width, height },
          },
          wrapper: anchorWrapper,
          params: { width, height },
        },
      );
    },
  });

  const renderFilterButton = (target) => {
    UI.render(Button, {
      children: labels.Global?.Filters,
      icon: Icon({ source: 'Burger' }),
      variant: 'secondary',
      onClick: () => {
        $facets.classList.toggle('search__facets--visible');
      },
    })(target);
  };

  const $desktopToggles = document.createElement('div');
  $desktopToggles.className = 'search__layout-toggles search__layout-toggles--desktop';

  if (listModeConfig.showToggle) {
    viewModeController.mountToggles($desktopToggles);
  }

  const $pageSizeContainer = document.createElement('div');
  $pageSizeContainer.className = 'search__page-size-container';

  await Promise.all([
    // Sort By
    provider.render(SortBy, {})($productSort),

    // Facets
    provider.render(Facets, {
      slots: {
        Facet: renderPriceRangeFacetSlot,
      },
    })($facets),
    // Product List
    provider.render(PlpSearchResults, {
      routeProduct: (product) => getProductLink(product.urlKey, product.sku),
      imageWidth: PLP_IMAGE_DIMENSIONS.width,
      imageHeight: PLP_IMAGE_DIMENSIONS.height,
      slots: productCardSlots,
    })($productList),
  ]);

  // "Filter By" heading above the facets sidebar (matches the source PLP)
  if ($facets.children.length && !$facets.querySelector('.search__facets-title')) {
    const $facetsTitle = document.createElement('h2');
    $facetsTitle.className = 'search__facets-title';
    $facetsTitle.textContent = labels.Search?.FilterBy || 'Filter By';
    $facets.prepend($facetsTitle);
  }

  initFacetAccordions($facets);

  const $filterButtonContainer = document.createElement('div');
  $filterButtonContainer.className = 'search__filter-button-container';
  renderFilterButton($filterButtonContainer);
  $viewFacets.appendChild($filterButtonContainer);

  if (listModeConfig.showToggle) {
    const $mobileToggles = document.createElement('div');
    $mobileToggles.className = 'search__layout-toggles search__layout-toggles--mobile';
    viewModeController.mountToggles($mobileToggles);
    $viewFacets.appendChild($mobileToggles);
  }

  // Toolbar order inside .search__product-sort: toggles → page size → sort picker
  const $sortPicker = $productSort.querySelector('.dropin-picker');
  if ($sortPicker) {
    $productSort.insertBefore($pageSizeContainer, $sortPicker);
    if (listModeConfig.showToggle) {
      $productSort.insertBefore($desktopToggles, $pageSizeContainer);
    }
  } else if (listModeConfig.showToggle) {
    $productSort.prepend($desktopToggles);
    $productSort.appendChild($pageSizeContainer);
  } else {
    $productSort.prepend($pageSizeContainer);
  }

  pageSizeController = createPageSizeController({
    container: $pageSizeContainer,
    storeConfig,
    getViewMode,
    initialPageSize: currentPageSize,
    labels: {
      show: labels.Search?.ShowPerPage || 'Show',
      perPage: labels.Search?.PerPage || 'Per Page',
    },
    onPageSizeChange: (nextSize) => {
      loadMoreController?.reset();
      scrollPageUrlSync?.reset();
      runSearch({ pageSize: nextSize });
    },
  });

  loadMoreController = createLoadMoreController({
    container: $pagination,
    getBatchSize: () => currentPageSize,
    initialLoadMorePage,
    onSearchContextChange: () => scrollPageUrlSync?.reset(),
    labels: {
      loadMore: labels.Search?.LoadMore || 'Load More',
      loading: labels.Search?.Loading || 'Loading...',
    },
  });

  scrollPageUrlSync = createScrollPageUrlSync({
    productListRoot: $productList,
    getBatchSize: () => currentPageSize,
    getLastRequest: () => loadMoreController?.getLastRequest() ?? null,
    buildUrl: () => canonicalizeCategoryUrl(new URL(window.location.href), categoryMeta),
  });

  storeConfigPromise.then((config) => {
    storeConfig = config;
    const resolvedPageSize = resolvePageSize({
      storeConfig,
      viewMode: getViewMode(),
      urlLimit: searchState.pageSize,
    }) || currentPageSize;
    if (resolvedPageSize !== currentPageSize) {
      currentPageSize = resolvedPageSize;
      pageSizeController?.syncToViewMode?.();
      runSearch({ pageSize: currentPageSize * initialLoadMorePage });
    }
  });

  let restoringFromHistory = false;

  const handlePopState = () => {
    restoringFromHistory = true;
    const urlState = getSearchStateFromUrl(new URL(window.location.href));
    const loadMorePage = Math.max(1, urlState.loadMorePage || 1);

    loadMoreController?.reset();
    scrollPageUrlSync?.reset();

    const pageSize = resolvePageSize({
      storeConfig,
      viewMode: getViewMode(),
      urlLimit: urlState.pageSize,
    }) || currentPageSize;

    currentPageSize = pageSize;

    runSearch({
      pageSize: pageSize * loadMorePage,
      filter: urlState.filter,
      sort: urlState.sort.length ? urlState.sort : undefined,
      phrase: urlState.phrase || undefined,
    });
  };

  window.addEventListener('popstate', handlePopState);

  // Listen for search results (event is fired before the block is rendered; eager: true)
  events.on('search/result', (payload) => {
    const totalCount = payload.result?.totalCount || 0;

    block.classList.toggle('product-list-page--empty', totalCount === 0);

    // Results Info
    $resultInfo.innerHTML = payload.request?.phrase
      ? `${totalCount} results found for <strong>"${payload.request.phrase}"</strong>.`
      : `${totalCount} results found.`;

    // Update the view facets button with the number of filters
    const $filterButton = $viewFacets.querySelector('.search__filter-button-container button');
    if (payload.request.filter.length > 0) {
      $filterButton?.setAttribute('data-count', payload.request.filter.length);
    } else {
      $filterButton?.removeAttribute('data-count');
    }

    window.requestAnimationFrame(() => {
      cardHandlers.resyncWishlist();
      scrollPageUrlSync?.refresh();
    });
  }, { eager: true });

  // Listen for search results (event is fired after the block is rendered; eager: false)
  // URL is owned by this project; update sort/filter/q; ?p= reflects visible batch while scrolling.
  events.on('search/result', (payload) => {
    if (restoringFromHistory) {
      restoringFromHistory = false;
      return;
    }

    const url = canonicalizeCategoryUrl(new URL(window.location.href), categoryMeta);
    const visiblePage = scrollPageUrlSync?.measureNow() ?? 1;
    applySearchStateToUrl(url, payload.request, { loadMorePage: visiblePage });
    if (url.href !== window.location.href) {
      const useReplaceState = loadMoreController?.consumeLoadMoreNavigation();
      if (useReplaceState) {
        window.history.replaceState({}, '', url.toString());
      } else {
        window.history.pushState({}, '', url.toString());
      }
    }
  }, { eager: false });
}
