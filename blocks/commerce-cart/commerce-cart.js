import { events } from '@dropins/tools/event-bus.js';
import { render as provider } from '@dropins/storefront-cart/render.js';
import * as Cart from '@dropins/storefront-cart/api.js';
import { h } from '@dropins/tools/preact.js';
import {
  InLineAlert,
  Icon,
  Button,
  provider as UI,
} from '@dropins/tools/components.js';

// Dropin Containers
import CartSummaryTable from '@dropins/storefront-cart/containers/CartSummaryTable.js';
import OrderSummary from '@dropins/storefront-cart/containers/OrderSummary.js';
import EstimateShipping from '@dropins/storefront-cart/containers/EstimateShipping.js';
import Coupons from '@dropins/storefront-cart/containers/Coupons.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';
import { WishlistAlert } from '@dropins/storefront-wishlist/containers/WishlistAlert.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';

// API
import { publishShoppingCartViewEvent } from '@dropins/storefront-cart/api.js';

// Modal and Mini PDP
import createMiniPDP from '../../scripts/components/commerce-mini-pdp/commerce-mini-pdp.js';
import createModal from '../modal/modal.js';

// Initializers
import '../../scripts/initializers/cart.js';
import '../../scripts/initializers/wishlist.js';

import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink, getProductLink } from '../../scripts/commerce.js';

/**
 * Adds edit + remove controls for cart table rows (TFS cart).
 * Uses updateProductsFromCart directly so remove keeps working after re-renders
 * (unlike moving Preact-managed DOM nodes).
 * @param {object} ctx CartSummaryTable Actions slot context
 * @param {Function} onEdit
 * @param {object} placeholders
 * @param {boolean} enableUpdatingProduct
 * @param {boolean} allowRemove
 */
function renderCartItemActions(ctx, onEdit, placeholders, enableUpdatingProduct, allowRemove) {
  const {
    item,
    itemsUpdating,
    setItemUpdating,
    setItemUpdateError,
  } = ctx;

  const actions = document.createElement('div');
  actions.className = 'cart-cart-summary-table__item-actions';

  const isConfigurable = item?.itemType === 'ConfigurableCartItem'
    || (Array.isArray(item?.selectedOptions) && item.selectedOptions.length > 0)
    || (item?.bundleOptions && Object.keys(item.bundleOptions).length > 0);

  if (enableUpdatingProduct && isConfigurable) {
    const editLink = document.createElement('div');
    editLink.className = 'cart-item-edit-link';

    UI.render(Button, {
      children: placeholders?.Global?.CartEditButton || 'Edit',
      'aria-label': `${placeholders?.Global?.CartEditButton || 'Edit'} ${item.name}`,
      variant: 'tertiary',
      size: 'medium',
      icon: h(Icon, { source: 'Edit' }),
      onClick: () => onEdit(item),
    })(editLink);

    actions.append(editLink);
  }

  if (allowRemove) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cart-cart-summary-table__item-remove-button';
    removeBtn.setAttribute('aria-label', `Remove ${item.name} from the cart`);
    removeBtn.setAttribute('data-testid', `cart-table-item-remove-${item.uid}`);
    /* Outline trash — matches `/icons/trash.svg` (feather trash-2). */
    removeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;

    const syncDisabled = () => {
      removeBtn.disabled = Boolean(itemsUpdating?.get?.(item.uid)?.isUpdating);
    };
    syncDisabled();

    removeBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (removeBtn.disabled) return;

      try {
        setItemUpdating?.(item.uid, true);
        await Cart.updateProductsFromCart([{ uid: item.uid, quantity: 0 }]);
      } catch (error) {
        console.error('Failed to remove cart item:', error);
        setItemUpdateError?.(item.uid, error?.message || 'Unable to remove item');
      } finally {
        setItemUpdating?.(item.uid, false);
      }
    });

    actions.append(removeBtn);

    ctx.onChange?.((next) => {
      removeBtn.disabled = Boolean(next.itemsUpdating?.get?.(next.item.uid)?.isUpdating);
    });
  }

  ctx.replaceWith(actions);
}

/**
 * loads and decorates the cart block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  // Configuration — defaults lean toward TFS cart behavior
  const {
    'hide-heading': hideHeading = 'false',
    'enable-item-quantity-update': enableUpdateItemQuantity = 'true',
    'enable-item-remove': enableRemoveItem = 'true',
    'enable-estimate-shipping': enableEstimateShipping = 'true',
    'start-shopping-url': startShoppingURL = '/',
    'checkout-url': checkoutURL = '',
    'enable-updating-product': enableUpdatingProduct = 'true',
    'undo-remove-item': undo = 'false',
  } = readBlockConfig(block);

  const placeholders = await fetchPlaceholders();

  let currentModal = null;
  let currentNotification = null;

  const fragment = document.createRange().createContextualFragment(`
    <div class="cart__notification"></div>
    <div class="cart__wrapper">
      <div class="cart__left-column">
        <h1 class="cart__title">Shopping Cart</h1>
        <div class="cart__list"></div>
        <div class="cart__actions">
          <a class="cart__action cart__action--continue" href="${rootLink(startShoppingURL || '/')}">Continue Shopping</a>
          <button type="button" class="cart__action cart__action--update">Update Shopping Cart</button>
        </div>
        <div class="cart__coupons"></div>
      </div>
      <div class="cart__right-column">
        <div class="cart__order-summary"></div>
      </div>
    </div>
    <div class="cart__empty-cart"></div>
  `);

  const $wrapper = fragment.querySelector('.cart__wrapper');
  const $notification = fragment.querySelector('.cart__notification');
  const $title = fragment.querySelector('.cart__title');
  const $list = fragment.querySelector('.cart__list');
  const $actions = fragment.querySelector('.cart__actions');
  const $coupons = fragment.querySelector('.cart__coupons');
  const $summary = fragment.querySelector('.cart__order-summary');
  const $emptyCart = fragment.querySelector('.cart__empty-cart');
  const $rightColumn = fragment.querySelector('.cart__right-column');
  const $updateBtn = fragment.querySelector('.cart__action--update');

  if (hideHeading === 'true') {
    $title.hidden = true;
  }

  block.innerHTML = '';
  block.appendChild(fragment);

  const routeToWishlist = rootLink('/wishlist');

  function toggleEmptyCart(isEmpty) {
    // Empty state is rendered inside CartSummaryTable; keep the list visible.
    $title.hidden = hideHeading === 'true' || isEmpty;
    $actions.hidden = isEmpty;
    $coupons.hidden = isEmpty;
    $rightColumn.style.display = isEmpty ? 'none' : '';
    $emptyCart.setAttribute('hidden', '');
    $wrapper.removeAttribute('hidden');
  }

  $updateBtn.addEventListener('click', async () => {
    $updateBtn.disabled = true;
    try {
      await Cart.refreshCart();
    } finally {
      $updateBtn.disabled = false;
    }
  });

  async function handleEditButtonClick(cartItem) {
    try {
      const miniPDPContent = await createMiniPDP(
        cartItem,
        async () => {
          const productName = cartItem.name
            || cartItem.product?.name
            || placeholders?.Global?.CartUpdatedProductName;
          const message = placeholders?.Global?.CartUpdatedProductMessage?.replace(
            '{product}',
            productName,
          );

          currentNotification?.remove();

          currentNotification = await UI.render(InLineAlert, {
            heading: message,
            type: 'success',
            variant: 'primary',
            icon: h(Icon, { source: 'CheckWithCircle' }),
            'aria-live': 'assertive',
            role: 'alert',
            onDismiss: () => {
              currentNotification?.remove();
            },
          })($notification);

          setTimeout(() => {
            currentNotification?.remove();
          }, 5000);
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

      currentNotification?.remove();

      currentNotification = await UI.render(InLineAlert, {
        heading: placeholders?.Global?.ProductLoadError,
        type: 'error',
        variant: 'primary',
        icon: h(Icon, { source: 'AlertWithCircle' }),
        'aria-live': 'assertive',
        role: 'alert',
        onDismiss: () => {
          currentNotification?.remove();
        },
      })($notification);
    }
  }

  const createProductLink = (product) => getProductLink(product.url.urlKey, product.topLevelSku);

  await Promise.all([
    provider.render(CartSummaryTable, {
      routeProduct: createProductLink,
      routeEmptyCartCTA: startShoppingURL ? () => rootLink(startShoppingURL) : undefined,
      allowQuantityUpdates: enableUpdateItemQuantity === 'true',
      allowRemoveItems: enableRemoveItem === 'true',
      undo: undo === 'true',
      slots: {
        Thumbnail: (ctx) => {
          const { item, defaultImageProps } = ctx;
          const anchorWrapper = document.createElement('a');
          anchorWrapper.href = createProductLink(item);

          tryRenderAemAssetsImage(ctx, {
            alias: item.sku,
            imageProps: defaultImageProps,
            wrapper: anchorWrapper,
            params: {
              width: defaultImageProps.width,
              height: defaultImageProps.height,
            },
          });
        },

        Sku: (ctx) => {
          ctx.remove();
        },

        Quantity: (ctx) => {
          const {
            item,
            isUpdating,
            quantityInputValue,
            handleInputChange,
          } = ctx;

          const wrap = document.createElement('div');
          wrap.className = 'cart-qty';

          const dec = document.createElement('button');
          dec.type = 'button';
          dec.className = 'cart-qty__btn cart-qty__btn--dec';
          dec.setAttribute('aria-label', `Decrease quantity for ${item.name}`);
          dec.textContent = '−';
          dec.disabled = isUpdating || quantityInputValue <= 1;

          const input = document.createElement('input');
          input.type = 'number';
          input.min = '1';
          input.className = 'cart-qty__input';
          input.value = String(quantityInputValue);
          input.setAttribute('aria-label', `Quantity for ${item.name}`);
          input.disabled = isUpdating;
          input.addEventListener('change', handleInputChange);

          const inc = document.createElement('button');
          inc.type = 'button';
          inc.className = 'cart-qty__btn cart-qty__btn--inc';
          inc.setAttribute('aria-label', `Increase quantity for ${item.name}`);
          inc.textContent = '+';
          inc.disabled = isUpdating;

          const emit = (next) => {
            const fakeEvent = {
              target: { value: String(next) },
              currentTarget: { value: String(next) },
            };
            handleInputChange(fakeEvent);
          };

          dec.addEventListener('click', () => {
            if (quantityInputValue > 1) emit(quantityInputValue - 1);
          });
          inc.addEventListener('click', () => emit(quantityInputValue + 1));

          wrap.append(dec, input, inc);
          ctx.replaceWith(wrap);
        },

        Actions: (ctx) => {
          renderCartItemActions(
            ctx,
            handleEditButtonClick,
            placeholders,
            enableUpdatingProduct === 'true',
            enableRemoveItem === 'true',
          );
        },
      },
    })($list),

    provider.render(OrderSummary, {
      routeCheckout: checkoutURL ? () => rootLink(checkoutURL) : undefined,
      enableCoupons: false,
      enableGiftCards: false,
      slots: {
        EstimateShipping: async (ctx) => {
          if (enableEstimateShipping === 'true') {
            const wrapper = document.createElement('div');
            await provider.render(EstimateShipping, {})(wrapper);
            ctx.replaceWith(wrapper);
          }
        },
      },
    })($summary),

    provider.render(Coupons)($coupons),
  ]);

  /**
   * Wraps estimate-shipping UI in a TFS-style accordion.
   */
  function decorateShippingAccordion() {
    const content = $summary.querySelector('.cart-order-summary__content');
    const shipping = $summary.querySelector('.cart-order-summary__shipping');
    if (!content || !shipping) return;

    let details = shipping.closest('.cart-shipping-accordion');
    if (!details) {
      details = document.createElement('details');
      details.className = 'cart-shipping-accordion';
      details.open = false;

      const summaryEl = document.createElement('summary');
      summaryEl.className = 'cart-shipping-accordion__summary';
      summaryEl.textContent = 'Estimate Shipping And Tax';

      shipping.parentNode.insertBefore(details, shipping);
      details.append(summaryEl, shipping);
    }

    // TFS: estimate shipping sits above subtotal / totals
    if (content.firstElementChild !== details) {
      content.prepend(details);
    }
  }

  /**
   * Ensures Order Total Excl. Tax appears when the drop-in only shows incl.
   * @param {object|null} cartData
   */
  function decorateExclTaxTotal(cartData) {
    const content = $summary.querySelector('.cart-order-summary__content');
    if (!content) return;

    let excl = content.querySelector('.cart-order-summary__total-excl');
    const totalRow = content.querySelector('.cart-order-summary__total');
    if (!totalRow) return;

    const exclPrice = cartData?.total?.excludingTax;
    if (exclPrice?.value == null) return;

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: exclPrice.currency || 'USD',
    }).format(exclPrice.value);

    if (!excl) {
      excl = document.createElement('div');
      excl.className = 'cart-order-summary__entry cart-order-summary__total cart-order-summary__total-excl';
      totalRow.after(excl);
    }
    excl.innerHTML = `<span>Order Total Excl. Tax</span><span class="cart-order-summary__price">${formatted}</span>`;
  }

  $emptyCart.setAttribute('hidden', '');

  const syncItemActions = () => {
    window.requestAnimationFrame(() => {
      decorateShippingAccordion();

      // Expand discount accordion by default (TFS shows code field open)
      const couponToggle = $coupons.querySelector(
        '.dropin-accordion-section__flex[aria-label*="Open"]',
      );
      couponToggle?.click();
    });
  };

  let cartViewEventPublished = false;
  events.on(
    'cart/data',
    (cartData) => {
      const isEmpty = !cartData || cartData.totalQuantity < 1;
      toggleEmptyCart(isEmpty);
      syncItemActions();
      window.requestAnimationFrame(() => decorateExclTaxTotal(cartData));

      if (!cartViewEventPublished) {
        cartViewEventPublished = true;
        publishShoppingCartViewEvent();
      }
    },
    { eager: true },
  );

  events.on('wishlist/alert', ({ action, item }) => {
    wishlistRender.render(WishlistAlert, {
      action,
      item,
      routeToWishlist,
    })($notification);

    setTimeout(() => {
      $notification.innerHTML = '';
    }, 5000);
  });

  return Promise.resolve();
}
