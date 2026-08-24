import * as cartApi from '@dropins/storefront-cart/api.js';
import * as pdpApi from '@dropins/storefront-pdp/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import {
  CS_FETCH_GRAPHQL,
  CUSTOMER_LOGIN_PATH,
  checkIsAuthenticated,
  getProductLink,
  rootLink,
} from '../../scripts/commerce.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { showWishlistAuthModal } from '../../scripts/wishlist-auth-modal.js';

import '../../scripts/initializers/cart.js';

pdpApi.setEndpoint(CS_FETCH_GRAPHQL);

const WISHLIST_IMAGE_DIMENSIONS = {
  width: 288,
  height: 288,
};

events.on('wishlist/alert', () => {
  setTimeout(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, 0);
});

export default async function decorate(block) {
  if (!checkIsAuthenticated()) {
    window.location.href = rootLink(CUSTOMER_LOGIN_PATH);
    return;
  }

  const {
    'start-shopping-url': startShoppingURL = '',
  } = readBlockConfig(block);

  await import('../../scripts/initializers/wishlist.js');
  const [{ render: wishlistRenderer }, { default: Wishlist }] = await Promise.all([
    import('@dropins/storefront-wishlist/render.js'),
    import('@dropins/storefront-wishlist/containers/Wishlist.js'),
  ]);

  await wishlistRenderer.render(Wishlist, {
    routeEmptyWishlistCTA: startShoppingURL ? () => rootLink(startShoppingURL) : undefined,
    moveProdToCart: cartApi.addProductsToCart,
    routeProdDetailPage: (product) => getProductLink(product.urlKey, product.sku),
    onLoginClick: (event) => showWishlistAuthModal(event),
    getProductData: pdpApi.getProductData,
    getRefinedProduct: pdpApi.getRefinedProduct,
    slots: {
      image: (ctx) => {
        const { item, defaultImageProps } = ctx;
        tryRenderAemAssetsImage(ctx, {
          alias: item.product.sku,
          imageProps: defaultImageProps,
          params: {
            width: defaultImageProps.width || WISHLIST_IMAGE_DIMENSIONS.width,
            height: defaultImageProps.height || WISHLIST_IMAGE_DIMENSIONS.height,
          },
        });
      },
    },
  })(block);
}
