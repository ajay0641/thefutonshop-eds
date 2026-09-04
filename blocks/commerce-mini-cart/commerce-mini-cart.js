import { render as provider } from '@dropins/storefront-cart/render.js';
import MiniCart from '@dropins/storefront-cart/containers/MiniCart.js';
import { events } from '@dropins/tools/event-bus.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import {
  InLineAlert,
  Icon,
  provider as UI,
  Button,
} from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';

import createModal from '../modal/modal.js';
import createMiniPDP from '../../scripts/components/commerce-mini-pdp/commerce-mini-pdp.js';

// Initializers
import '../../scripts/initializers/cart.js';

import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink, getProductLink } from '../../scripts/commerce.js';
import { getCartItemImageSlotConfig } from '../../scripts/product-image.js';
import { removeOwnedCartLineItem } from '../../scripts/cart-sync.js';

/**
 * Wraps option rows in a "See Details" accordion (TFS reference).
 * @param {Element} root
 */
function decorateSeeDetails(root) {
  root.querySelectorAll('.dropin-cart-item__configurations').forEach((list) => {
    if (list.closest('.commerce-mini-cart__details')) return;

    const details = document.createElement('details');
    details.className = 'commerce-mini-cart__details';

    const summary = document.createElement('summary');
    summary.className = 'commerce-mini-cart__details-summary';
    summary.textContent = 'See Details';

    list.parentNode.insertBefore(details, list);
    details.append(summary, list);
  });
}

const REMOVE_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
`;

/**
 * Builds the TFS-style drawer header: count + View Cart + close.
 * @param {string} cartURL
 * @returns {HTMLElement}
 */
function createMiniCartHeader(cartURL) {
  const header = document.createElement('div');
  header.className = 'commerce-mini-cart__header';

  const title = document.createElement('p');
  title.className = 'commerce-mini-cart__title';

  const actions = document.createElement('div');
  actions.className = 'commerce-mini-cart__header-actions';

  const viewCart = document.createElement('a');
  viewCart.className = 'commerce-mini-cart__view-cart';
  viewCart.href = cartURL ? rootLink(cartURL) : rootLink('/cart');
  viewCart.textContent = 'View Cart';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'commerce-mini-cart__close';
  closeBtn.setAttribute('aria-label', 'Close cart');
  closeBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('minicart:close'));
  });

  actions.append(viewCart, closeBtn);
  header.append(title, actions);

  const updateTitle = (cart) => {
    const qty = cart?.totalQuantity ?? 0;
    const label = qty === 1 ? 'Item' : 'Items';
    title.textContent = `${qty} ${label} in Cart`;
  };

  events.on('cart/data', updateTitle, { eager: true });
  updateTitle(events.lastPayload('cart/data'));

  return header;
}

export default async function decorate(block) {
  const {
    'start-shopping-url': startShoppingURL = '',
    'cart-url': cartURL = '',
    'checkout-url': checkoutURL = '',
    'enable-updating-product': enableUpdatingProduct = 'true',
    'undo-remove-item': undo = 'false',
  } = readBlockConfig(block);

  // Get translations for custom messages
  const placeholders = await fetchPlaceholders();

  const MESSAGES = {
    ADDED: placeholders?.Global?.MiniCartAddedMessage,
    UPDATED: placeholders?.Global?.MiniCartUpdatedMessage,
  };

  // Modal state
  let currentModal = null;
  let currentCartNotification = null;

  // Create a container for the update message
  const updateMessage = document.createElement('div');
  updateMessage.className = 'commerce-mini-cart__update-message';

  // Create shadow wrapper
  const shadowWrapper = document.createElement('div');
  shadowWrapper.className = 'commerce-mini-cart__message-wrapper';
  shadowWrapper.appendChild(updateMessage);

  const showMessage = (message) => {
    updateMessage.textContent = message;
    updateMessage.classList.add('commerce-mini-cart__update-message--visible');
    shadowWrapper.classList.add('commerce-mini-cart__message-wrapper--visible');
    setTimeout(() => {
      updateMessage.classList.remove(
        'commerce-mini-cart__update-message--visible',
      );
      shadowWrapper.classList.remove(
        'commerce-mini-cart__message-wrapper--visible',
      );
    }, 3000);
  };

  // Handle Edit Button Click
  async function handleEditButtonClick(cartItem) {
    try {
      // Create mini PDP content
      const miniPDPContent = await createMiniPDP(
        cartItem,
        async (_updateData) => {
          const productName = cartItem.name
            || cartItem.product?.name
            || placeholders?.Global?.CartUpdatedProductName;
          const message = placeholders?.Global?.CartUpdatedProductMessage?.replace(
            '{product}',
            productName,
          );

          // Show message in the main cart page
          const cartNotification = document.querySelector(
            '.cart__notification',
          );
          if (cartNotification) {
            // Clear any existing cart notifications
            currentCartNotification?.remove();

            currentCartNotification = await UI.render(InLineAlert, {
              heading: message,
              type: 'success',
              variant: 'primary',
              icon: h(Icon, { source: 'CheckWithCircle' }),
              'aria-live': 'assertive',
              role: 'alert',
              onDismiss: () => {
                currentCartNotification?.remove();
              },
            })(cartNotification);

            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              currentCartNotification?.remove();
            }, 5000);
          }

          // Also trigger message in the mini-cart
          showMessage(message);
        },
        () => {
          if (currentModal) {
            currentModal.removeModal();
            currentModal = null;
          }
        },
      );

      currentModal = await createModal([miniPDPContent]);

      if (currentModal.block) {
        currentModal.block.setAttribute('id', 'mini-pdp-modal');
      }

      currentModal.showModal();
    } catch (error) {
      console.error('Error opening mini PDP modal:', error);

      // Show error message using mini-cart's message system
      showMessage(
        placeholders?.Global?.ProductLoadError,
      );
    }
  }

  // Add event listeners for cart updates
  events.on('cart/product/added', () => showMessage(MESSAGES.ADDED), {
    eager: true,
  });
  events.on('cart/product/updated', () => showMessage(MESSAGES.UPDATED), {
    eager: true,
  });

  // Prevent mini cart from closing when undo is enabled
  if (undo === 'true') {
    // Add event listener to prevent event bubbling from remove buttons
    block.addEventListener('click', (e) => {
      // Check if click is on a remove button or within an undo-related element
      const isRemoveButton = e.target.closest('[class*="remove"]')
        || e.target.closest('[data-testid*="remove"]')
        || e.target.closest('[class*="undo"]')
        || e.target.closest('[data-testid*="undo"]');

      if (isRemoveButton) {
        // Stop the event from bubbling up to document level
        e.stopPropagation();
      }
    });
  }

  block.innerHTML = '';

  // Render MiniCart
  const createProductLink = (product) => getProductLink(product.url.urlKey, product.topLevelSku);
  await provider.render(MiniCart, {
    routeEmptyCartCTA: startShoppingURL ? () => rootLink(startShoppingURL) : undefined,
    routeCart: cartURL ? () => rootLink(cartURL) : undefined,
    routeCheckout: checkoutURL ? () => rootLink(checkoutURL) : undefined,
    routeProduct: createProductLink,
    undo: undo === 'true',
    hideHeading: true,
    enableItemRemoval: true,
    enableQuantityUpdate: true,

    slots: {
      ItemSku: (ctx) => {
        ctx.remove();
      },

      Thumbnail: (ctx) => {
        const { item, defaultImageProps } = ctx;
        const anchorWrapper = document.createElement('a');
        anchorWrapper.href = createProductLink(item);
        anchorWrapper.className = 'dropin-cart-item__image';
        anchorWrapper.setAttribute('aria-label', item?.name || item?.sku || 'Product');

        tryRenderAemAssetsImage(ctx, {
          ...getCartItemImageSlotConfig(defaultImageProps, item),
          wrapper: anchorWrapper,
        });
      },

      ItemRemoveAction: (ctx) => {
        const {
          item,
          enableRemoveItem,
          handleItemsLoading,
          handleItemsError,
          itemsLoading,
        } = ctx;

        // Build edit + remove in-slot (do not move Preact DOM nodes — that
        // breaks click handlers after cart re-renders).
        const actions = document.createElement('div');
        actions.className = 'commerce-mini-cart__item-actions';

        if (item?.itemType === 'ConfigurableCartItem' && enableUpdatingProduct === 'true') {
          const editLink = document.createElement('div');
          editLink.className = 'cart-item-edit-link';

          UI.render(Button, {
            children: placeholders?.Global?.CartEditButton || 'Edit',
            'aria-label': `${placeholders?.Global?.CartEditButton || 'Edit'} ${item.name}`,
            variant: 'tertiary',
            size: 'medium',
            icon: h(Icon, { source: 'Edit' }),
            onClick: () => handleEditButtonClick(item),
          })(editLink);

          actions.append(editLink);
        }

        if (enableRemoveItem !== false) {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'commerce-mini-cart__remove-btn';
          removeBtn.setAttribute('aria-label', `Remove ${item.name} from the cart`);
          removeBtn.setAttribute('data-testid', 'cart-item-remove-button');
          removeBtn.dataset.uid = item.uid;
          removeBtn.innerHTML = REMOVE_ICON_SVG;
          let lineItem = item;

          const syncDisabled = () => {
            removeBtn.disabled = Boolean(itemsLoading?.has?.(lineItem.uid));
          };
          syncDisabled();

          removeBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (removeBtn.disabled) return;

            const { uid } = lineItem;
            try {
              handleItemsLoading?.(uid, true);
              await removeOwnedCartLineItem(lineItem);
            } catch (error) {
              console.error('Failed to remove mini-cart item:', error);
              handleItemsError?.(uid, error?.message || 'Unable to remove item');
            } finally {
              handleItemsLoading?.(uid, false);
            }
          });

          actions.append(removeBtn);

          ctx.onChange?.((next) => {
            lineItem = next.item;
            removeBtn.dataset.uid = next.item.uid;
            removeBtn.disabled = Boolean(next.itemsLoading?.has?.(next.item.uid));
          });
        }

        ctx.replaceWith(actions);
      },
    },
  })(block);

  block.prepend(createMiniCartHeader(cartURL));

  // Find the products container and add the message div at the top
  const productsContainer = block.querySelector('.cart-mini-cart__products');
  if (productsContainer) {
    productsContainer.insertBefore(shadowWrapper, productsContainer.firstChild);
  } else {
    console.info('Products container not found, appending message to block');
    block.appendChild(shadowWrapper);
  }

  const decorateItems = () => {
    decorateSeeDetails(block);
  };

  decorateItems();
  events.on('cart/data', () => {
    window.requestAnimationFrame(decorateItems);
  });

  return block;
}
