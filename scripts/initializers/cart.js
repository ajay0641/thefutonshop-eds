import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '@dropins/storefront-cart/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core)
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Fetch placeholders
  const labels = await fetchPlaceholders('placeholders/cart.json');

  const langDefinitions = {
    default: {
      ...labels,
      Cart: {
        ...(labels?.Cart || {}),
        MiniCart: {
          ...(labels?.Cart?.MiniCart || {}),
          heading: '{count} Item in Cart',
          subtotal: 'Cart Subtotal :',
          subtotalExcludingTaxes: 'Cart Subtotal :',
          cartLink: 'View Cart',
          checkoutLink: 'Proceed to Checkout',
        },
      },
    },
  };

  // Initialize cart
  return initializers.mountImmediately(initialize, { langDefinitions });
})();
