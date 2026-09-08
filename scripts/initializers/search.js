import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '@dropins/storefront-product-discovery/api.js';
import { initializeDropin } from './index.js';
import { CS_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

await initializeDropin(async () => {
  // Inherit Fetch GraphQL Instance (Catalog Service)
  setEndpoint(CS_FETCH_GRAPHQL);

  // Fetch placeholders
  const labels = await fetchPlaceholders('placeholders/search.json');
  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  const models = {
    Product: {
      transformer: (raw) => ({
        averageRating: raw?.averageRating ?? 0,
        reviewCount: raw?.reviewCount ?? 0,
      }),
    },
  };

  // Initialize search
  return initializers.mountImmediately(initialize, { langDefinitions, models });
})();
