// Drop-in Tools
import { getCookie } from '@dropins/tools/lib.js';
import { events } from '@dropins/tools/event-bus.js';
import { initializers } from '@dropins/tools/initializer.js';
import { isAemAssetsEnabled } from '@dropins/tools/lib/aem/assets.js';
import { getConfigValue, getRootPath } from '@dropins/tools/lib/aem/configs.js';
import { CORE_FETCH_GRAPHQL, CS_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

const DROPIN_WEBSITE_COOKIE = 'dropin_website_path';
const getWebsitePath = () => getRootPath() || '/';
const clearCookie = (name) => { document.cookie = `${name}=; path=/; Max-Age=0`; };

export const getUserTokenCookie = () => getCookie('auth_dropin_user_token');

const setAuthHeaders = (state) => {
  if (state) {
    const token = getUserTokenCookie();
    CORE_FETCH_GRAPHQL.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
  } else {
    CORE_FETCH_GRAPHQL.removeFetchGraphQlHeader('Authorization');
  }
};

const setCustomerGroupHeader = (customerGroupId) => {
  CS_FETCH_GRAPHQL.setFetchGraphQlHeader('Magento-Customer-Group', customerGroupId);
};

const setAdobeCommerceOptimizerHeader = (adobeCommerceOptimizer) => {
  if (adobeCommerceOptimizer?.priceBookId) {
    CS_FETCH_GRAPHQL.setFetchGraphQlHeader('AC-Price-Book-ID', adobeCommerceOptimizer.priceBookId);
  } else {
    CS_FETCH_GRAPHQL.removeFetchGraphQlHeader('AC-Price-Book-ID');
  }
};

const persistCartDataInSession = (data) => {
  if (data?.id) {
    sessionStorage.setItem('DROPINS_CART_ID', data.id);
  } else {
    sessionStorage.removeItem('DROPINS_CART_ID');
  }
};

const setupAemAssetsImageParams = () => {
  if (isAemAssetsEnabled()) {
    // Convert decimal values to integers for AEM Assets compatibility
    initializers.setImageParamKeys({
      width: (value) => ['width', Math.floor(value)],
      height: (value) => ['height', Math.floor(value)],
      quality: 'quality',
      auto: 'auto',
      crop: 'crop',
      fit: 'fit',
    });
  }
};

export default async function initializeDropins() {
  const init = async () => {
    // Set Customer-Group-ID header
    if (getConfigValue('adobe-commerce-optimizer')) {
      events.on('auth/adobe-commerce-optimizer', setAdobeCommerceOptimizerHeader, { eager: true });
    } else {
      events.on('auth/group-uid', setCustomerGroupHeader, { eager: true });
    }

    // Clear cart state when switching between websites to avoid stale cart IDs
    // and authentication state from a different website causing errors.
    const storedWebsitePath = getCookie(DROPIN_WEBSITE_COOKIE);
    const currentWebsitePath = getWebsitePath();
    if (storedWebsitePath && storedWebsitePath !== currentWebsitePath) {
      clearCookie('DROPIN__CART__CART-ID');
      sessionStorage.removeItem('DROPINS_CART_ID');
      sessionStorage.removeItem('DROPIN__CART__CART__DATA');
      sessionStorage.removeItem('DROPIN__CART__SHIPPING__DATA');
      localStorage.removeItem('DROPIN__CART__CART__AUTHENTICATED');
    }
    document.cookie = `${DROPIN_WEBSITE_COOKIE}=${currentWebsitePath}; path=/`;

    /**
     * Keep GraphQL auth headers + cart auth flag in sync with the session.
     * Do NOT call refreshCart here — cart setEndpoint may not be ready yet
     * (causes Missing "url"). Cart initializer syncs the owned cart id after mount.
     * @param {boolean} isAuthenticated
     */
    const onAuthenticated = (isAuthenticated) => {
      setAuthHeaders(isAuthenticated);

      if (isAuthenticated) {
        localStorage.setItem('DROPIN__CART__CART__AUTHENTICATED', 'true');
        return;
      }

      if (!getUserTokenCookie()) {
        localStorage.removeItem('DROPIN__CART__CART__AUTHENTICATED');
      }
    };

    events.on('authenticated', onAuthenticated, { eager: true });

    // Cache cart data in session storage
    events.on('cart/data', persistCartDataInSession, { eager: true });

    // on page load, check if user is authenticated
    const token = getUserTokenCookie();
    // Keep cart auth flag in sync with the real token. A stale "authenticated"
    // flag without a token clears the guest cart; a missing flag with a token
    // makes checkout refresh initialize as guest then fail to re-sync.
    if (token) {
      localStorage.setItem('DROPIN__CART__CART__AUTHENTICATED', 'true');
    } else {
      localStorage.removeItem('DROPIN__CART__CART__AUTHENTICATED');
    }
    // set auth headers (cart id sync happens in cart.js after setEndpoint)
    setAuthHeaders(!!token);

    // Event Bus Logger
    events.enableLogger(true);

    // Set up AEM Assets image parameter conversion
    setupAemAssetsImageParams();

    // Fetch global placeholders
    await fetchPlaceholders('placeholders/global.json');

    // Initialize Global Drop-ins
    await import('./auth.js');

    await import('./personalization.js');

    // Await cart so setEndpoint runs before any page-level cart API use
    await import('./cart.js');

    events.on('aem/lcp', async () => {
      // Recaptcha
      await import('@dropins/tools/recaptcha.js').then((recaptcha) => {
        recaptcha.setEndpoint(CORE_FETCH_GRAPHQL);
        recaptcha.enableLogger(true);
        return recaptcha.setConfig();
      });
    }, { eager: true });
  };

  // re-initialize on prerendering changes
  document.addEventListener('prerenderingchange', initializeDropins, { once: true });

  return init();
}

export function initializeDropin(cb) {
  let initialized = false;

  const init = async (force = false) => {
    // prevent re-initialization
    if (initialized && !force) return;
    // initialize drop-in
    await cb();
    initialized = true;
  };

  // re-initialize on prerendering changes
  document.addEventListener('prerenderingchange', () => init(true), { once: true });

  return init;
}
