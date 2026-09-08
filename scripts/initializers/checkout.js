import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint, setFetchGraphQlHeader } from '@dropins/storefront-checkout/api.js';
import { getUserTokenCookie, initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';
import { syncCartAuthHeaders } from '../cart-sync.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core)
  setEndpoint(CORE_FETCH_GRAPHQL);

  const token = getUserTokenCookie();
  if (token) {
    setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
    syncCartAuthHeaders(true);
  }

  // Fetch placeholders
  const labels = await fetchPlaceholders('placeholders/checkout.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  // Initialize checkout
  return initializers.mountImmediately(initialize, { langDefinitions });
})();
