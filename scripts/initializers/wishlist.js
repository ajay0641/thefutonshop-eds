import { initializers } from '@dropins/tools/initializer.js';
import { events } from '@dropins/tools/event-bus.js';
import { verifyToken } from '@dropins/storefront-auth/api.js';
import { getHeaders } from '@dropins/tools/lib/aem/configs.js';
import { getUserTokenCookie, initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isWishlistAuthError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('isn\'t authorized')
    || message.includes('cannot perform operations on wishlist');
}

/**
 * @param {typeof import('@dropins/storefront-wishlist/api.js')} wishlistApi
 * @param {boolean} isAuthenticated
 */
function syncWishlistAuthHeaders(wishlistApi, isAuthenticated) {
  const token = getUserTokenCookie();
  if (isAuthenticated && token) {
    wishlistApi.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
  } else {
    wishlistApi.removeFetchGraphQlHeader('Authorization');
  }
}

/**
 * @param {typeof import('@dropins/storefront-wishlist/api.js')} wishlistApi
 */
async function recoverWishlistAfterImport(wishlistApi) {
  const { initializeWishlist, resetWishlist } = wishlistApi;

  if (!getUserTokenCookie()) {
    await resetWishlist();
    return;
  }

  try {
    await initializeWishlist();
  } catch (error) {
    if (!isWishlistAuthError(error)) throw error;
    console.warn('Wishlist init failed for the current session.', error);
    await resetWishlist();
  }
}

await initializeDropin(async () => {
  if (getUserTokenCookie()) {
    await verifyToken();
  }

  const wishlistApi = await import('@dropins/storefront-wishlist/api.js');
  const { initialize, setEndpoint } = wishlistApi;

  setEndpoint(CORE_FETCH_GRAPHQL);
  syncWishlistAuthHeaders(wishlistApi, !!getUserTokenCookie());
  events.on('authenticated', (isAuthenticated) => {
    syncWishlistAuthHeaders(wishlistApi, isAuthenticated);
  });

  await recoverWishlistAfterImport(wishlistApi);

  const headers = getHeaders('wishlist');
  const labels = await fetchPlaceholders('placeholders/wishlist.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  const initOptions = {
    langDefinitions,
    isGuestWishlistEnabled: false,
    storeCode: headers.Store,
  };

  try {
    await initializers.mountImmediately(initialize, initOptions);
  } catch (error) {
    if (!isWishlistAuthError(error)) throw error;
    console.warn('Wishlist drop-in init failed for the current session.', error);
    await wishlistApi.resetWishlist();
  }
})();
