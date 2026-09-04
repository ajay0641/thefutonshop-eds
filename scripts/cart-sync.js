import { getCookie } from '@dropins/tools/lib.js';
import { events } from '@dropins/tools/event-bus.js';
import * as Cart from '@dropins/storefront-cart/api.js';
import { CORE_FETCH_GRAPHQL } from './commerce.js';

/**
 * Minimal update mutation — bypasses drop-in error handler `ie()` which clears
 * cart auth state and returns null (leaving an empty UI while Magento still
 * has items).
 */
const UPDATE_CART_ITEMS_MUTATION = `
  mutation UPDATE_CART_ITEM_QUANTITY($cartId: String!, $cartItems: [CartItemUpdateInput!]!) {
    updateCartItems(input: { cart_id: $cartId, cart_items: $cartItems }) {
      cart {
        id
        total_quantity
      }
    }
  }
`;

/**
 * @returns {string|undefined}
 */
export function getAuthToken() {
  return getCookie('auth_dropin_user_token');
}

/**
 * Ensures Authorization is on the shared Core GraphQL client (cart is linked).
 * @param {boolean} isAuthenticated
 */
export function syncCartAuthHeaders(isAuthenticated) {
  const token = getAuthToken();
  if (isAuthenticated && token) {
    CORE_FETCH_GRAPHQL.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
    Cart.setFetchGraphQlHeader?.('Authorization', `Bearer ${token}`);
  } else {
    CORE_FETCH_GRAPHQL.removeFetchGraphQlHeader('Authorization');
    Cart.removeFetchGraphQlHeader?.('Authorization');
  }
}

/**
 * Drop-in ownership errors call ie() which clears authenticated + cartId.
 * Restore before any cart read/mutate when a token is present.
 * @returns {boolean}
 */
export function restoreCartAuthState() {
  const token = getAuthToken();
  if (!token) return false;
  localStorage.setItem('DROPIN__CART__CART__AUTHENTICATED', 'true');
  Cart.s.authenticated = true;
  syncCartAuthHeaders(true);
  return true;
}

/**
 * Clears only the cart-id cookie (not cart item cache). A stale guest id with a
 * Bearer token causes "cannot perform operations on cart".
 */
export function clearStoredCartId() {
  document.cookie = 'DROPIN__CART__CART-ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
  sessionStorage.removeItem('DROPINS_CART_ID');
}

/**
 * @param {object} item
 * @param {object|null} cart
 * @returns {string|undefined}
 */
export function resolveCartItemUid(item, cart) {
  if (!item?.uid) return undefined;
  const items = cart?.items || [];
  const match = items.find((entry) => entry.uid === item.uid)
    || items.find((entry) => entry.topLevelSku === item.topLevelSku && entry.sku === item.sku)
    || items.find((entry) => entry.sku === item.sku && entry.name === item.name);
  return match?.uid || item.uid;
}

/**
 * Loads the cart owned by the current user and persists its id for mutations.
 * Logged-in: drop guest cart-id first so refresh uses customerCart only.
 * A guest id + Bearer token causes ownership errors and checkout sync loops.
 * @returns {Promise<object|null>}
 */
export async function ensureOwnedCart() {
  const isAuth = restoreCartAuthState();

  if (isAuth) {
    clearStoredCartId();
    restoreCartAuthState();
  }

  try {
    const cart = await Cart.refreshCart();
    if (cart?.id) {
      Cart.s.cartId = cart.id;
      events.emit('cart/data', cart);
      return cart;
    }
  } catch (error) {
    console.error('Failed to refresh cart:', error);
  }

  if (isAuth) {
    restoreCartAuthState();
    try {
      const customerCart = await Cart.getCartData();
      if (customerCart?.id) {
        Cart.s.cartId = customerCart.id;
        events.emit('cart/data', customerCart);
        return customerCart;
      }
    } catch (error) {
      console.error('Failed to load customer cart:', error);
      restoreCartAuthState();
    }
  }

  return Cart.getCartDataFromCache();
}

/**
 * Removes a line item using the owned cart id via a direct GraphQL mutation
 * (avoids drop-in ie() wiping client cart on ownership errors).
 * @param {object} item
 * @returns {Promise<object>}
 */
export async function removeOwnedCartLineItem(item) {
  const cart = await ensureOwnedCart();
  const uid = resolveCartItemUid(item, cart);

  if (!cart?.id || !uid) {
    await ensureOwnedCart();
    throw new Error('Cart item is not available');
  }

  Cart.s.cartId = cart.id;
  restoreCartAuthState();

  const { errors, data } = await Cart.fetchGraphQl(UPDATE_CART_ITEMS_MUTATION, {
    method: 'POST',
    variables: {
      cartId: cart.id,
      cartItems: [{ cart_item_uid: uid, quantity: 0 }],
    },
  });

  const messages = [
    ...(errors || []).map((entry) => entry.message),
    ...(data?.updateCartItems?.user_errors || []).map((entry) => entry.message),
  ].filter(Boolean);

  if (messages.length) {
    const message = messages.join(' ');
    // Ownership / auth — clear stale id, reload owned cart, retry once
    if (
      message.includes('cannot perform operations on cart')
      || message.includes("isn't authorized")
    ) {
      clearStoredCartId();
      restoreCartAuthState();
      const retryCart = await ensureOwnedCart();
      const retryUid = resolveCartItemUid(item, retryCart);
      if (!retryCart?.id || !retryUid) {
        await ensureOwnedCart();
        throw new Error(message);
      }

      const retry = await Cart.fetchGraphQl(UPDATE_CART_ITEMS_MUTATION, {
        method: 'POST',
        variables: {
          cartId: retryCart.id,
          cartItems: [{ cart_item_uid: retryUid, quantity: 0 }],
        },
      });
      const retryMessages = [
        ...(retry.errors || []).map((entry) => entry.message),
        ...(retry.data?.updateCartItems?.user_errors || []).map((entry) => entry.message),
      ].filter(Boolean);
      if (retryMessages.length) {
        await ensureOwnedCart();
        throw new Error(retryMessages.join(' '));
      }
    } else {
      await ensureOwnedCart();
      throw new Error(message);
    }
  }

  // Re-load full cart model into UI (mutation response is minimal)
  const next = await ensureOwnedCart();
  if (!next) {
    events.emit('cart/data', null);
  }
  return next;
}
