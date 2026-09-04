/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */

// Dropin Tools
import { events } from '@dropins/tools/event-bus.js';
import { initReCaptcha } from '@dropins/tools/recaptcha.js';

// Order Dropin Modules
import * as orderApi from '@dropins/storefront-order/api.js';

// Checkout Dropin Libraries
import {
  createScopedSelector,
  isVirtualCart,
  setMetaTags,
  validateForms,
} from '@dropins/storefront-checkout/lib/utils.js';

// Payment Services Dropin
import { PaymentMethodCode } from '@dropins/storefront-payment-services/api.js';

// Block Utilities
import {
  buildOrderDetailsUrl,
  displayOverlaySpinner,
  removeOverlaySpinner,
} from './utils.js';

// Fragment functions
import {
  createCheckoutFragment,
  selectors,
} from './fragments.js';

// Container functions
import {
  renderAddressForm,
  renderBillingAddressFormSkeleton,
  renderBillToShippingAddress,
  renderCartSummaryList,
  renderCheckoutHeader,
  renderCustomerBillingAddresses,
  renderCustomerShippingAddresses,
  renderGiftOptions,
  renderHeaderLogin,
  renderLoginForm,
  renderMergedCartBanner,
  renderOrderSummary,
  renderOutOfStock,
  renderPaymentMethods,
  renderPlaceOrder,
  renderServerError,
  renderShippingAddressFormSkeleton,
  renderShippingMethods,
  renderTermsAndConditions,
} from './containers.js';

// Constants
import {
  BILLING_ADDRESS_DATA_KEY,
  BILLING_FORM_NAME,
  LOGIN_FORM_NAME,
  PURCHASE_ORDER_FORM_NAME,
  SHIPPING_ADDRESS_DATA_KEY,
  SHIPPING_FORM_NAME,
  TERMS_AND_CONDITIONS_FORM_NAME,
} from './constants.js';

import { rootLink } from '../../scripts/commerce.js';
import { getUserTokenCookie } from '../../scripts/initializers/index.js';

// Initializers — cart before checkout so checkout does not mount against a null cart
import '../../scripts/initializers/cart.js';
import '../../scripts/initializers/account.js';
import '../../scripts/initializers/order.js';
import '../../scripts/initializers/payment-services.js';

// Checkout success block import and CSS preload
import { renderCheckoutSuccess, preloadCheckoutSuccess } from '../commerce-checkout-success/commerce-checkout-success.js';

preloadCheckoutSuccess();

/**
 * Redirect to cart only when we have a definitive empty cart model.
 * The cart drop-in emits `null` while loading, during auth resets/merges, and on
 * transient fetch failures — treating `null` as empty incorrectly sends shoppers
 * from /checkout back to /cart (and can race with guest→customer cart sync).
 * @param {import('@dropins/storefront-cart/data/models').CartModel|null|undefined} cartData
 */
function redirectToCartIfEmpty(cartData) {
  const isOrderPlaced = events.lastPayload('order/placed') !== undefined;
  if (isOrderPlaced || cartData == null) return;

  if (cartData.items?.length === 0) {
    window.location.href = rootLink('/cart');
  }
}

/**
 * Wait until cart/initialized has fired (including a cached eager payload).
 * Eager callbacks can run synchronously inside events.on(), so do not close over
 * a const subscription before it is assigned (TDZ crash on live/CDN timing).
 * @returns {Promise<import('@dropins/storefront-cart/data/models').CartModel|null>}
 */
function waitForCartInitialized() {
  return new Promise((resolve) => {
    let resolved = false;
    let subscription;
    const onInitialized = (data) => {
      if (resolved) return;
      resolved = true;
      subscription?.off();
      resolve(data ?? null);
    };
    subscription = events.on('cart/initialized', onInitialized, { eager: true });
    if (resolved) subscription.off();
  });
}

/**
 * If checkout initialized with null before cart was ready, poke cart/updated so
 * the checkout drop-in re-syncs (it only listens to cart/updated after init).
 * @param {import('@dropins/storefront-cart/data/models').CartModel|null|undefined} cartData
 */
function recoverCheckoutFromCart(cartData) {
  if (!cartData?.items?.length) return;
  const checkoutData = events.lastPayload('checkout/updated')
    ?? events.lastPayload('checkout/initialized');
  if (checkoutData) return;
  events.emit('cart/updated', cartData);
}

export default async function decorate(block) {
  setMetaTags('Checkout');
  document.title = 'Checkout';

  // Ensure cart has settled before mounting checkout (avoids null init on refresh)
  const cartData = await waitForCartInitialized();
  redirectToCartIfEmpty(cartData);

  // Mount checkout after cart/initialized so its eager cart listener gets real data
  await import('../../scripts/initializers/checkout.js');

  // Container and component references
  let shippingForm;
  let billingForm;
  let shippingAddresses;
  let billingAddresses;

  const shippingFormRef = { current: null };
  const billingFormRef = { current: null };
  const creditCardFormRef = { current: null };
  const loaderRef = { current: null };

  events.on('order/placed', () => {
    setMetaTags('Order Confirmation');
    document.title = 'Order Confirmation';
  });

  // Create the checkout layout using fragments
  const checkoutFragment = createCheckoutFragment();

  // Create scoped selector for the checkout fragment
  const getElement = createScopedSelector(checkoutFragment);

  // Get all checkout elements using centralized selectors
  const $content = getElement(selectors.checkout.content);
  const $loader = getElement(selectors.checkout.loader);
  const $loaderStatus = getElement(selectors.checkout.loaderStatus);
  const $mergedCartBanner = getElement(selectors.checkout.mergedCartBanner);
  const $heading = getElement(selectors.checkout.heading);
  const $headerLogin = getElement(selectors.checkout.headerLogin);
  const $serverError = getElement(selectors.checkout.serverError);
  const $outOfStock = getElement(selectors.checkout.outOfStock);
  const $login = getElement(selectors.checkout.login);
  const $shippingForm = getElement(selectors.checkout.shippingForm);
  const $billToShipping = getElement(selectors.checkout.billToShipping);
  const $delivery = getElement(selectors.checkout.delivery);
  const $paymentMethods = getElement(selectors.checkout.paymentMethods);
  const $billingForm = getElement(selectors.checkout.billingForm);
  const $orderSummary = getElement(selectors.checkout.orderSummary);
  const $cartSummary = getElement(selectors.checkout.cartSummary);
  const $placeOrder = getElement(selectors.checkout.placeOrder);
  const $giftOptions = getElement(selectors.checkout.giftOptions);
  const $termsAndConditions = getElement(selectors.checkout.termsAndConditions);

  block.appendChild(checkoutFragment);

  renderHeaderLogin($headerLogin);

  function positionLoginFormInShippingForm() {
    if (!$shippingForm || !$login) return;
    const place = () => {
      const titleEl = $shippingForm.querySelector(
        '.account-address-form-wrapper__title, .dropin-header-container__title',
      );
      if (titleEl && titleEl.nextSibling !== $login) {
        titleEl.after($login);
      }
    };
    place();
    setTimeout(place, 100);
    setTimeout(place, 500);
  }

  function positionBillToShippingInShippingForm() {
    if (!$shippingForm || !$billToShipping) return;
    const place = () => {
      if (!$shippingForm.contains($billToShipping)) {
        $shippingForm.appendChild($billToShipping);
      }
    };
    place();
    setTimeout(place, 100);
    setTimeout(place, 500);
  }

  function positionGiftCardsInPaymentMethods() {
    if (!$paymentMethods || !$orderSummary) return;
    const move = () => {
      const giftCards = $orderSummary.querySelector('.cart-order-summary__gift-cards, .cart-gift-cards');
      if (giftCards && !$paymentMethods.contains(giftCards)) {
        $paymentMethods.appendChild(giftCards);
      }
    };
    move();
    setTimeout(move, 100);
    setTimeout(move, 500);

    const observer = new MutationObserver(move);
    observer.observe($orderSummary, { childList: true, subtree: true });
  }

  positionGiftCardsInPaymentMethods();

  function positionOrderSummaryContent() {
    if (!$orderSummary || !$cartSummary) return;

    const move = () => {
      const orderHeading = $orderSummary.querySelector('.cart-order-summary__heading');
      const orderHeadingText = $orderSummary.querySelector('.cart-order-summary__heading-text');
      if (orderHeadingText && orderHeadingText.textContent !== 'Order Summary') {
        orderHeadingText.textContent = 'Order Summary';
      }

      if (orderHeading && $cartSummary.previousElementSibling !== orderHeading) {
        orderHeading.after($cartSummary);
      }

      const cartHeading = $cartSummary?.querySelector('.cart-summary-list__heading-text');
      if (cartHeading && (cartHeading.innerText.includes('Your Cart') || cartHeading.innerText.includes('Cart'))) {
        const countMatch = cartHeading.innerText.match(/\((\d+)\)/);
        const count = countMatch ? countMatch[1] : '';
        cartHeading.innerText = count ? `${count} ITEMS IN CART` : 'ITEMS IN CART';
      }

      if ($placeOrder && $orderSummary.lastElementChild !== $placeOrder) {
        $orderSummary.appendChild($placeOrder);
      }

      $orderSummary.querySelectorAll('.dropin-cart-item').forEach((item) => {
        const qtyVal = item.querySelector('.dropin-cart-item__quantity__value, .dropin-cart-item__quantity');
        if (qtyVal && !qtyVal.dataset.formatted) {
          const numMatch = qtyVal.innerText.match(/\d+/);
          const num = numMatch ? numMatch[0] : '1';
          qtyVal.innerHTML = `Qty: ${num}`;
          qtyVal.dataset.formatted = 'true';
        }

        const img = item.querySelector('.dropin-cart-item__image img');
        if (img) {
          const srcset = img.getAttribute('srcset');
          if (srcset && srcset.includes('height=NaN')) {
            img.removeAttribute('srcset');
          }
          if (!img.dataset.errorHandled) {
            img.dataset.errorHandled = 'true';
            img.addEventListener('error', () => {
              img.removeAttribute('srcset');
              img.src = '/icons/cart.svg';
            });
          }
        }
      });
    };

    move();
    setTimeout(move, 100);
    setTimeout(move, 500);
    setTimeout(move, 1500);

    const observer = new MutationObserver(move);
    observer.observe($orderSummary, { childList: true });
    if ($cartSummary) {
      observer.observe($cartSummary, { childList: true });
    }
  }

  positionOrderSummaryContent();

  const handleValidation = () => validateForms([
    { name: LOGIN_FORM_NAME },
    { name: SHIPPING_FORM_NAME, ref: shippingFormRef },
    { name: BILLING_FORM_NAME, ref: billingFormRef },
    { name: PURCHASE_ORDER_FORM_NAME },
    { name: TERMS_AND_CONDITIONS_FORM_NAME },
  ]);

  const handlePlaceOrder = async ({ cartId, code }) => {
    await displayOverlaySpinner(loaderRef, $loader, $loaderStatus);
    try {
      // Payment Services credit card
      if (code === PaymentMethodCode.CREDIT_CARD) {
        if (!creditCardFormRef.current) {
          console.error('Credit card form not rendered.');
          return;
        }
        if (!creditCardFormRef.current.validate()) {
          // Credit card form invalid; abort order placement
          return;
        }
        // Submit Payment Services credit card form
        await creditCardFormRef.current.submit();
      }
      // Place order
      await orderApi.placeOrder(cartId);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      removeOverlaySpinner(loaderRef, $loader, $loaderStatus);
    }
  };

  // First, render the place order component
  await renderPlaceOrder($placeOrder, { handleValidation, handlePlaceOrder });

  // Render the remaining containers
  const [
    _mergedCartBanner,
    _header,
    _serverError,
    _outOfStock,
    _loginForm,
    shippingFormSkeleton,
    _billToShipping,
    _shippingMethods,
    _paymentMethods,
    billingFormSkeleton,
    _orderSummary,
    _cartSummary,
    _termsAndConditions,
    _giftOptions,
  ] = await Promise.all([
    renderMergedCartBanner($mergedCartBanner),

    renderCheckoutHeader($heading, 'Checkout'),

    renderServerError($serverError, $content),

    renderOutOfStock($outOfStock),

    renderLoginForm($login),

    renderShippingAddressFormSkeleton($shippingForm),

    renderBillToShippingAddress($billToShipping),

    renderShippingMethods($delivery),

    renderPaymentMethods($paymentMethods, creditCardFormRef),

    renderBillingAddressFormSkeleton($billingForm),

    renderOrderSummary($orderSummary),

    renderCartSummaryList($cartSummary),

    renderTermsAndConditions($termsAndConditions),

    renderGiftOptions($giftOptions),
  ]);

  async function initializeCheckout(data) {
    await initReCaptcha(0);
    if (data.isGuest) await displayGuestAddressForms(data);
    else {
      removeOverlaySpinner(loaderRef, $loader, $loaderStatus);
      await displayCustomerAddressForms(data);
    }
  }

  async function displayGuestAddressForms(data) {
    if (isVirtualCart(data)) {
      shippingForm?.remove();
      shippingForm = null;
      $shippingForm.innerHTML = '';
    } else if (!shippingForm) {
      shippingFormSkeleton.remove();

      shippingForm = await renderAddressForm($shippingForm, shippingFormRef, data, 'shipping');
    }

    if (!billingForm) {
      billingFormSkeleton.remove();

      billingForm = await renderAddressForm($billingForm, billingFormRef, data, 'billing');
    }

    positionLoginFormInShippingForm();
    positionBillToShippingInShippingForm();
  }

  async function displayCustomerAddressForms(data) {
    if (isVirtualCart(data)) {
      shippingAddresses?.remove();
      shippingAddresses = null;
      $shippingForm.innerHTML = '';
    } else if (!shippingAddresses) {
      shippingForm?.remove();
      shippingForm = null;
      shippingFormRef.current = null;

      shippingAddresses = await renderCustomerShippingAddresses(
        $shippingForm,
        shippingFormRef,
        data,
      );
    }

    if (!billingAddresses) {
      billingForm?.remove();
      billingForm = null;
      billingFormRef.current = null;

      billingAddresses = await renderCustomerBillingAddresses(
        $billingForm,
        billingFormRef,
        data,
      );
    }

    positionLoginFormInShippingForm();
    positionBillToShippingInShippingForm();
  }

  async function handleCheckoutUpdated(data) {
    if (!data) {
      // Null init/reset — try to recover from the latest cart model
      recoverCheckoutFromCart(
        events.lastPayload('cart/data') ?? events.lastPayload('cart/initialized'),
      );
      return;
    }
    await initializeCheckout(data);
  }

  // Only reload when the shopper signs in during checkout (guest → customer).
  // Reloading on every authenticated=true (including page refresh) aborts
  // address/payment hydration and leaves skeletons + "No payment methods".
  let isAuthenticated = events.lastPayload('authenticated') === true
    || Boolean(getUserTokenCookie());

  function handleAuthenticated(authenticated) {
    if (!authenticated) {
      isAuthenticated = false;
      return;
    }

    if (isAuthenticated) return;
    isAuthenticated = true;

    // When a customer creates an account on the checkout success page and then
    // signs in, they will be redirected to the order details page with the order
    // number as orderRef, allowing the order details to be displayed
    const orderData = events.lastPayload('order/placed');
    if (orderData) {
      const url = buildOrderDetailsUrl(orderData);
      window.history.pushState({}, '', url);
    }

    window.location.reload();
  }

  function handleCheckoutValues(payload) {
    const { isBillToShipping } = payload;
    $billingForm.style.display = isBillToShipping ? 'none' : 'block';
  }

  async function handleOrderPlaced(orderData) {
    // Clear address form data
    sessionStorage.removeItem(SHIPPING_ADDRESS_DATA_KEY);
    sessionStorage.removeItem(BILLING_ADDRESS_DATA_KEY);

    const url = buildOrderDetailsUrl(orderData);

    window.history.pushState({}, '', url);

    await renderCheckoutSuccess(block, { orderData });
  }

  events.on('authenticated', handleAuthenticated);
  events.on('checkout/initialized', handleCheckoutUpdated, { eager: true });
  events.on('checkout/updated', handleCheckoutUpdated);
  events.on('checkout/values', handleCheckoutValues);
  events.on('order/placed', handleOrderPlaced);
  events.on('cart/initialized', redirectToCartIfEmpty, { eager: true });
  events.on('cart/data', (data) => {
    redirectToCartIfEmpty(data);
    recoverCheckoutFromCart(data);
  });

  // Logged-in refresh: if checkout still has no model, force a cart sync once
  if (getUserTokenCookie()) {
    recoverCheckoutFromCart(
      events.lastPayload('cart/data') ?? events.lastPayload('cart/initialized'),
    );
  }
}
