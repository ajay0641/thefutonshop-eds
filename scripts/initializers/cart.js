import { initializers } from '@dropins/tools/initializer.js';
import {
  initialize,
  setEndpoint,
} from '@dropins/storefront-cart/api.js';
import { getUserTokenCookie, initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';
import { ensureOwnedCart } from '../cart-sync.js';

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
        heading: 'Shopping Cart',
        MiniCart: {
          ...(labels?.Cart?.MiniCart || {}),
          heading: '{count} Item in Cart',
          subtotal: 'Cart Subtotal :',
          subtotalExcludingTaxes: 'Cart Subtotal :',
          cartLink: 'View Cart',
          checkoutLink: 'Proceed to Checkout',
        },
        CartSummaryTable: {
          ...(labels?.Cart?.CartSummaryTable || {}),
          item: 'Product Name',
          price: 'Price',
          qty: 'Qty',
          subtotal: 'Subtotal',
          mobilePrice: 'Price',
          mobileQty: 'Qty',
          mobileSubtotal: 'Subtotal',
        },
        PriceSummary: {
          ...(labels?.Cart?.PriceSummary || {}),
          checkout: 'Proceed to Checkout',
          orderSummary: 'Summary',
          coupon: {
            ...(labels?.Cart?.PriceSummary?.coupon || {}),
            title: 'Apply Discount Code',
            applyAction: 'Apply',
            placeholder: 'Enter Code',
          },
          shipping: {
            ...(labels?.Cart?.PriceSummary?.shipping || {}),
            estimated: 'Estimate Shipping And Tax',
            label: 'Shipping',
          },
          total: {
            ...(labels?.Cart?.PriceSummary?.total || {}),
            estimated: 'Order Total Incl. Tax',
            label: 'Order Total Incl. Tax',
            withoutTax: 'Order Total Excl. Tax',
          },
          taxes: {
            ...(labels?.Cart?.PriceSummary?.taxes || {}),
            total: 'Tax',
            totalOnly: 'Tax',
            estimated: 'Tax',
          },
        },
      },
    },
  };

  // Initialize cart
  await initializers.mountImmediately(initialize, { langDefinitions });

  // Logged-in: replace stale guest cart cookie with customerCart id
  if (getUserTokenCookie()) {
    try {
      await ensureOwnedCart();
    } catch (error) {
      console.error('Failed to sync customer cart on init:', error);
    }
  }
})();
