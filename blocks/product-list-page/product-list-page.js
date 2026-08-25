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
import { getSearchStateFromUrl, applySearchStateToUrl } from './search-url.js';

/** Default PLP card image size (matches Product Discovery SearchResults defaults). */
const PLP_IMAGE_DIMENSIONS = {
  width: 400,
  height: 450,
};

// Initializers
import '../../scripts/initializers/search.js';
import '../../scripts/initializers/wishlist.js';

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

  const config = readBlockConfig(block);
  const pageSize = parseInt(config.pagesize, 10) || 9;
  const categoryMeta = getCategoryFromUrl();

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

  // Add url path back to the block for enrichment, incase enrichment block is
  // executed after the plp block and block config is not available
  if (config.urlpath) {
    block.dataset.urlpath = config.urlpath;
  }
  if (categoryMeta?.cateId) {
    block.dataset.categoryId = categoryMeta.cateId;
  }

  const searchState = getSearchStateFromUrl(new URL(window.location.href));

  // Default visibility filter for all of our requests
  const visibilityFilter = { attribute: 'visibility', in: ['Search', 'Catalog, Search'] };
  const userFilters = searchState.filter.filter((f) => f.attribute !== 'visibility');

  // Normalize URL if scripts.js has not already canonicalized it
  let normalizedUrl = new URL(window.location.href);
  if (shouldCanonicalizeCategoryUrl(normalizedUrl, categoryMeta)) {
    normalizedUrl = canonicalizeCategoryUrl(normalizedUrl, categoryMeta);
    applySearchStateToUrl(normalizedUrl, searchState);
    window.history.replaceState({}, '', normalizedUrl.toString());
  } else {
    applySearchStateToUrl(normalizedUrl, searchState);
    if (normalizedUrl.href !== window.location.href) {
      window.history.replaceState({}, '', normalizedUrl.toString());
    }
  }

  // Request search based on the page type on block load
  if (config.urlpath) {
    // If it's a category page...
    await search({
      phrase: '', // search all products in the category
      currentPage: searchState.currentPage,
      pageSize,
      sort: searchState?.sort?.length ? searchState.sort : [{ attribute: 'position', direction: 'DESC' }],
      filter: [
        { attribute: 'categoryPath', eq: config.urlpath }, // Add category filter
        // Always add visibility filter to the request
        visibilityFilter,
        ...userFilters,
      ],
    }).catch(() => {
      console.error('Error searching for products');
    });
  } else {
    // Search page: dropin uses only the request (no URL parsing).
    await search({
      phrase: searchState.phrase,
      currentPage: searchState.currentPage,
      pageSize,
      sort: searchState.sort,
      // Always add visibility filter to the request
      filter: [visibilityFilter, ...userFilters],
    }).catch((e) => {
      console.error('Error searching for products', e);
    });
  }

  const requiresPdpConfiguration = (product) => product.typename === 'ComplexProductView'
    || product.attributes?.some((attr) => attr.name === 'ac_giftcard');

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

    // View Facets Button
    UI.render(Button, {
      children: labels.Global?.Filters,
      icon: Icon({ source: 'Burger' }),
      variant: 'secondary',
      onClick: () => {
        $facets.classList.toggle('search__facets--visible');
      },
    })($viewFacets),

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

  // Listen for search results (event is fired before the block is rendered; eager: true)
  events.on('search/result', (payload) => {
    const totalCount = payload.result?.totalCount || 0;

    block.classList.toggle('product-list-page--empty', totalCount === 0);

    // Results Info
    $resultInfo.innerHTML = payload.request?.phrase
      ? `${totalCount} results found for <strong>"${payload.request.phrase}"</strong>.`
      : `${totalCount} results found.`;

    // Update the view facets button with the number of filters
    if (payload.request.filter.length > 0) {
      $viewFacets.querySelector('button').setAttribute('data-count', payload.request.filter.length);
    } else {
      $viewFacets.querySelector('button').removeAttribute('data-count');
    }
  }, { eager: true });

  // Listen for search results (event is fired after the block is rendered; eager: false)
  // URL is owned by this project; update it when search state changes.
  events.on('search/result', (payload) => {
    const url = canonicalizeCategoryUrl(new URL(window.location.href), categoryMeta);
    applySearchStateToUrl(url, payload.request);
    if (url.href !== window.location.href) {
      window.history.pushState({}, '', url.toString());
    }
  }, { eager: false });
}
