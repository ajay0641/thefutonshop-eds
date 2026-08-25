// Product Discovery Dropins
import SearchResults from '@dropins/storefront-product-discovery/containers/SearchResults.js';
import Facets from '@dropins/storefront-product-discovery/containers/Facets.js';
import SortBy from '@dropins/storefront-product-discovery/containers/SortBy.js';
import Pagination from '@dropins/storefront-product-discovery/containers/Pagination.js';
import { render as provider } from '@dropins/storefront-product-discovery/render.js';
import { Button, Icon, provider as UI } from '@dropins/tools/components.js';
import { search } from '@dropins/storefront-product-discovery/api.js';
// Wishlist Dropin
import { WishlistToggle } from '@dropins/storefront-wishlist/containers/WishlistToggle.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';
// Cart Dropin
import * as cartApi from '@dropins/storefront-cart/api.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
// Event Bus
import { events } from '@dropins/tools/event-bus.js';
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
import { getSearchStateFromUrl, applySearchStateToUrl } from './search-url.js';
import {
  createViewModeController,
  parseListMode,
} from './view-mode.js';
import { fetchPlpStoreConfig, getPerPageConfigForView } from './store-config.js';
import { createPageSizeController, resolvePageSize } from './page-size.js';
// Initializers
import '../../scripts/initializers/search.js';
import '../../scripts/initializers/wishlist.js';

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
  const [labels, storeConfig] = await Promise.all([
    fetchPlaceholders(),
    fetchPlpStoreConfig(),
  ]);
  const listModeConfig = parseListMode(storeConfig.listMode);
  const storeListMode = storeConfig.listMode;

  const config = readBlockConfig(block);
  const categoryMeta = getCategoryFromUrl();

  let currentPageSize;
  /** @type {ReturnType<typeof createPageSizeController>|null} */
  let pageSizeController = null;
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
        runSearch({ pageSize: nextSize, currentPage: 1 });
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

  let categoryName = null;
  if (config.urlpath) {
    const ancestors = await getCategoryAncestors(config.urlpath);
    categoryName = ancestors.at(-1)?.name || null;
  }

  const fragment = document.createRange().createContextualFragment(`
    <div class="search__wrapper">
      <div class="search__category-title"></div>
      <div class="search__result-info"></div>
      <div class="search__view-facets"></div>
      <div class="search__facets"></div>
      <div class="search__product-sort"></div>
      <div class="search__product-list"></div>
      <div class="search__pagination"></div>
    </div>
  `);

  const $categoryTitle = fragment.querySelector('.search__category-title');
  const $resultInfo = fragment.querySelector('.search__result-info');
  const $viewFacets = fragment.querySelector('.search__view-facets');
  const $facets = fragment.querySelector('.search__facets');
  const $productSort = fragment.querySelector('.search__product-sort');
  const $productList = fragment.querySelector('.search__product-list');
  const $pagination = fragment.querySelector('.search__pagination');

  block.innerHTML = '';
  block.appendChild(fragment);

  if (categoryName) {
    const heading = document.createElement('h1');
    heading.textContent = categoryName;
    $categoryTitle.append(heading);
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
  currentPageSize = resolvePageSize({
    storeConfig,
    viewMode: getViewMode(),
    urlLimit: searchState.pageSize,
  }) || parseInt(config.pagesize, 10) || getDefaultPageSize();

  runSearch = async (overrides = {}) => {
    const urlState = getSearchStateFromUrl(new URL(window.location.href));
    const pageSize = overrides.pageSize ?? currentPageSize;
    const currentPage = overrides.currentPage ?? 1;
    const sort = overrides.sort ?? (urlState.sort.length
      ? urlState.sort
      : [{ attribute: 'position', direction: 'DESC' }]);
    const filter = overrides.filter ?? urlState.filter.filter((f) => f.attribute !== 'visibility');
    const phrase = overrides.phrase ?? urlState.phrase;

    currentPageSize = pageSize;

    const visibilityFilter = { attribute: 'visibility', in: ['Search', 'Catalog, Search'] };
    const request = {
      phrase,
      currentPage,
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
      defaultPageSize: getDefaultPageSize(),
    });
    window.history.replaceState({}, '', normalizedUrl.toString());
  } else {
    applySearchStateToUrl(normalizedUrl, initialUrlState, {
      defaultPageSize: getDefaultPageSize(),
    });
    if (normalizedUrl.href !== window.location.href) {
      window.history.replaceState({}, '', normalizedUrl.toString());
    }
  }

  // Request search based on the page type on block load
  if (config.urlpath) {
    await runSearch({
      currentPage: searchState.currentPage,
      pageSize: currentPageSize,
    });
  } else {
    await runSearch({
      currentPage: searchState.currentPage,
      pageSize: currentPageSize,
      phrase: searchState.phrase,
    });
  }

  const requiresPdpConfiguration = (product) => product.typename === 'ComplexProductView'
    || product.attributes?.some((attr) => attr.name === 'ac_giftcard');

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

  const getAddToCartButton = (product) => {
    const productName = product.name || product.sku;
    const addToCartLabel = `${labels.Global?.AddProductToCart} ${productName}`;

    if (requiresPdpConfiguration(product)) {
      const button = document.createElement('div');
      UI.render(Button, {
        'aria-label': addToCartLabel,
        children: labels.Global?.AddProductToCart,
        icon: Icon({ source: 'Cart' }),
        href: getProductLink(product.urlKey, product.sku),
        variant: 'primary',
      })(button);
      return button;
    }
    const button = document.createElement('div');
    UI.render(Button, {
      'aria-label': addToCartLabel,
      children: labels.Global?.AddProductToCart,
      icon: Icon({ source: 'Cart' }),
      onClick: () => cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]),
      variant: 'primary',
      disabled: !product.inStock,
    })(button);
    return button;
  };

  const $pageSizeContainer = document.createElement('div');
  $pageSizeContainer.className = 'search__page-size-container';

  await Promise.all([
    // Sort By
    provider.render(SortBy, {})($productSort),

    // Pagination
    provider.render(Pagination, {
      onPageChange: () => {
        // scroll to the top of the page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    })($pagination),

    // Facets
    provider.render(Facets, {})($facets),
    // Product List
    provider.render(SearchResults, {
      routeProduct: (product) => getProductLink(product.urlKey, product.sku),
      imageWidth: PLP_IMAGE_DIMENSIONS.width,
      imageHeight: PLP_IMAGE_DIMENSIONS.height,
      slots: {
        ProductImage: (ctx) => {
          const { product, defaultImageProps } = ctx;
          const width = defaultImageProps.width || PLP_IMAGE_DIMENSIONS.width;
          const height = defaultImageProps.height || PLP_IMAGE_DIMENSIONS.height;
          const anchorWrapper = document.createElement('a');
          anchorWrapper.href = getProductLink(product.urlKey, product.sku);
          anchorWrapper.setAttribute('aria-label', product.name || product.sku);

          // defaultImageProps.params often only includes width; without height,
          // srcset URLs become ?height=NaN and Commerce media URLs fail to load.
          tryRenderAemAssetsImage(ctx, {
            alias: product.sku,
            imageProps: {
              ...defaultImageProps,
              width,
              height,
              params: { ...defaultImageProps.params, width, height },
            },
            wrapper: anchorWrapper,
            params: { width, height },
          });
        },
        ProductActions: (ctx) => {
          const actionsWrapper = document.createElement('div');
          actionsWrapper.className = 'product-discovery-product-actions';
          // Add to Cart Button
          const addToCartBtn = getAddToCartButton(ctx.product);
          addToCartBtn.className = 'product-discovery-product-actions__add-to-cart';
          // Wishlist Button
          const $wishlistToggle = document.createElement('div');
          $wishlistToggle.classList.add('product-discovery-product-actions__wishlist-toggle');
          wishlistRender.render(WishlistToggle, {
            product: ctx.product,
            variant: 'tertiary',
          })($wishlistToggle);
          actionsWrapper.appendChild(addToCartBtn);
          actionsWrapper.appendChild($wishlistToggle);
          ctx.replaceWith(actionsWrapper);
        },
      },
    })($productList),
  ]);

  // "Filter By" heading above the facets sidebar (matches the source PLP)
  if ($facets.children.length && !$facets.querySelector('.search__facets-title')) {
    const $facetsTitle = document.createElement('h2');
    $facetsTitle.className = 'search__facets-title';
    $facetsTitle.textContent = labels.Search?.FilterBy || 'Filter By';
    $facets.prepend($facetsTitle);
  }

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

  if (listModeConfig.showToggle) {
    $productSort.prepend($desktopToggles);
    viewModeController.setViewMode(block.dataset.viewMode);
  }

  $productSort.prepend($pageSizeContainer);
  pageSizeController = createPageSizeController({
    container: $pageSizeContainer,
    storeConfig,
    getViewMode,
    initialPageSize: currentPageSize,
    labels: {
      show: labels.Search?.ShowPerPage || 'Show',
      perPage: labels.Search?.PerPage || 'per page',
    },
    onPageSizeChange: (nextSize) => {
      runSearch({ pageSize: nextSize, currentPage: 1 });
    },
  });

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
  }, { eager: true });

  // Listen for search results (event is fired after the block is rendered; eager: false)
  // URL is owned by this project; update it when search state changes.
  events.on('search/result', (payload) => {
    const url = canonicalizeCategoryUrl(new URL(window.location.href), categoryMeta);
    applySearchStateToUrl(url, payload.request, { defaultPageSize: getDefaultPageSize() });
    if (url.href !== window.location.href) {
      window.history.pushState({}, '', url.toString());
    }
  }, { eager: false });
}
