import { events } from '@dropins/tools/event-bus.js';
import {
  checkIsAuthenticated,
  CORE_FETCH_GRAPHQL,
  getProductLink,
  rootLink,
} from './commerce.js';
import { getUserTokenCookie } from './initializers/index.js';
import {
  showCartErrorToast,
  showCartSuccessToast,
  showWishlistErrorToast,
  showWishlistLoginToast,
  showWishlistSuccessToast,
} from './components/tfs-wishlist-toast/tfs-wishlist-toast.js';
import { showWishlistAuthModal } from './wishlist-auth-modal.js';
import { setProductCardActionLoading } from './product-card.js';

/**
 * @param {HTMLElement|null} button
 * @param {boolean} loading
 */
export function setTfsCardActionLoading(button, loading) {
  setProductCardActionLoading(button, loading);
}

/**
 * Whether the shopper must open the PDP to configure the product before cart/wishlist.
 * PLP search products often omit `addToCartAllowed` (drop-in maps missing → false), so
 * do not treat that alone as "needs PDP". Prefer GraphQL `__typename`.
 * @param {{ isPriceRange?: boolean, addToCartAllowed?: boolean, typename?: string, options?: unknown[], attributes?: Array<{ name?: string }> }} product
 * @returns {boolean}
 */
export function requiresTfsPdpConfiguration(product) {
  if (!product) return true;

  if (product.attributes?.some((attr) => attr.name === 'ac_giftcard')) {
    return true;
  }

  // Catalog Service / Live Search product views
  if (product.typename === 'ComplexProductView') {
    return true;
  }
  if (product.typename === 'SimpleProductView') {
    return false;
  }

  // Configurable options without a Complex typename (some custom queries)
  if (Array.isArray(product.options) && product.options.length > 0) {
    return true;
  }

  // Slider / other models that include these fields explicitly
  return product.isPriceRange === true || product.addToCartAllowed === false;
}

/**
 * @param {typeof import('@dropins/storefront-cart/api.js')} cartApi
 */
function syncCartAuthHeaders(cartApi) {
  const token = getUserTokenCookie();
  if (token) {
    cartApi.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
  } else {
    cartApi.removeFetchGraphQlHeader('Authorization');
  }
}

/**
 * @param {typeof import('@dropins/storefront-cart/api.js')} cartApi
 */
async function ensureCartReady(cartApi) {
  if (cartApi.getCartDataFromCache()) return;

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    events.on('cart/initialized', finish, { eager: true });
    window.setTimeout(finish, 5000);
  });
}

/**
 * @param {import('@dropins/storefront-cart/data/models').CartModel|null|undefined} cart
 * @param {string} sku
 * @param {number} previousQuantity
 */
function wasProductAddedToCart(cart, sku, previousQuantity) {
  if (!cart) return false;
  const normalizedSku = sku.toUpperCase();
  const itemAdded = (cart.items || []).some((item) => {
    const itemSku = (item.product?.sku || item.sku || '').toUpperCase();
    const topSku = (item.product?.topLevelSku || item.topLevelSku || '').toUpperCase();
    return itemSku === normalizedSku || topSku === normalizedSku;
  });
  return itemAdded || (cart.totalQuantity ?? 0) > previousQuantity;
}

/**
 * @param {typeof import('@dropins/storefront-wishlist/api.js')} wishlistApi
 */
function syncWishlistAuthHeaders(wishlistApi) {
  const token = getUserTokenCookie();
  if (token) {
    wishlistApi.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
  } else {
    wishlistApi.removeFetchGraphQlHeader('Authorization');
  }
}

/**
 * @param {HTMLElement} button
 * @param {string} sku
 * @param {typeof import('@dropins/storefront-wishlist/api.js')} wishlistApi
 */
function updateWishlistButtonState(button, sku, wishlistApi) {
  if (!checkIsAuthenticated()) {
    button.classList.remove('is-active');
    button.setAttribute('aria-pressed', 'false');
    return;
  }
  const inWishlist = !!wishlistApi.findInPersistedAllWishlistItems(sku);
  button.classList.toggle('is-active', inWishlist);
  button.setAttribute('aria-pressed', inWishlist ? 'true' : 'false');
}

/**
 * @param {typeof import('@dropins/storefront-wishlist/api.js')} wishlistApi
 */
function canUseWishlistApi(wishlistApi) {
  const cfg = wishlistApi.getConfig?.() || wishlistApi.config;
  return cfg?.wishlistIsEnabled !== false;
}

/** @param {unknown} error */
function getWishlistErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return 'We could not update your wishlist. Please try again.';
}

/** @param {unknown} error */
function getCartErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return 'We could not add this item to your cart. Please try again.';
}

/**
 * Wires TFS product card cart + wishlist actions (same behavior as tfs-product-slider).
 * @param {Element} root
 * @returns {Promise<{
 *   onAddToCartClick: Function,
 *   onWishlistClick: Function,
 *   resyncWishlist: Function
 * }>}
 */
export async function createTfsProductCardHandlers(root) {
  await Promise.all([
    import('./initializers/cart.js'),
    import('./initializers/wishlist.js'),
  ]);

  const [cartApi, wishlistApi] = await Promise.all([
    import('@dropins/storefront-cart/api.js'),
    import('@dropins/storefront-wishlist/api.js'),
  ]);

  cartApi.setEndpoint(CORE_FETCH_GRAPHQL);
  syncCartAuthHeaders(cartApi);
  await ensureCartReady(cartApi);

  wishlistApi.setEndpoint(CORE_FETCH_GRAPHQL);
  syncWishlistAuthHeaders(wishlistApi);

  const resyncWishlist = () => {
    root.querySelectorAll('.tfsproductslider-product-card__wishlist').forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const { sku } = button.dataset;
      if (sku) updateWishlistButtonState(button, sku, wishlistApi);
    });
  };

  events.on('authenticated', () => {
    syncCartAuthHeaders(cartApi);
    syncWishlistAuthHeaders(wishlistApi);
    ensureCartReady(cartApi).catch(console.error);
    resyncWishlist();
  });

  events.on('wishlist/data', resyncWishlist);

  const onAddToCartClick = async (product, button) => {
    if (!product?.sku) return;

    if (requiresTfsPdpConfiguration(product)) {
      window.location.href = getProductLink(product.urlKey, product.sku);
      return;
    }

    if (product.inStock === false) {
      await showCartErrorToast('This product is currently out of stock.');
      return;
    }

    setTfsCardActionLoading(button, true);
    try {
      syncCartAuthHeaders(cartApi);
      await ensureCartReady(cartApi);
      const previousQuantity = cartApi.getCartDataFromCache()?.totalQuantity ?? 0;
      const cart = await cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]);
      if (!wasProductAddedToCart(cart, product.sku, previousQuantity)) {
        throw new Error('Product was not added to your cart. Please try again.');
      }
      try {
        await cartApi.getCartData();
      } catch {
        // best effort
      }
      await showCartSuccessToast(product.name, () => {
        window.location.href = rootLink('/cart');
      });
    } catch (error) {
      await showCartErrorToast(getCartErrorMessage(error));
      console.error('PLP: add to cart failed', error);
    } finally {
      setTfsCardActionLoading(button, false);
    }
  };

  const onWishlistClick = async (product, button) => {
    if (!product?.sku) return;

    if (requiresTfsPdpConfiguration(product)) {
      window.location.href = getProductLink(product.urlKey, product.sku);
      return;
    }

    if (!checkIsAuthenticated()) {
      showWishlistLoginToast(() => {
        showWishlistAuthModal();
      });
      return;
    }

    if (!canUseWishlistApi(wishlistApi)) {
      showWishlistErrorToast('Wishlist is not available for this store.');
      return;
    }

    syncWishlistAuthHeaders(wishlistApi);
    const existing = wishlistApi.findInPersistedAllWishlistItems(product.sku);
    const isRemove = !!existing;

    setTfsCardActionLoading(button, true);
    try {
      if (isRemove) {
        await wishlistApi.removeProductsFromWishlist([existing]);
      } else {
        await wishlistApi.addProductsToWishlist([{ sku: product.sku, quantity: 1 }]);
      }
      button.dataset.sku = product.sku;
      updateWishlistButtonState(button, product.sku, wishlistApi);
      await showWishlistSuccessToast(isRemove ? 'remove' : 'add', product.name);
    } catch (error) {
      await showWishlistErrorToast(getWishlistErrorMessage(error));
      console.error('PLP: wishlist toggle failed', error);
    } finally {
      setTfsCardActionLoading(button, false);
    }
  };

  // Initial sync after cards render
  window.requestAnimationFrame(resyncWishlist);

  return { onAddToCartClick, onWishlistClick, resyncWishlist };
}
