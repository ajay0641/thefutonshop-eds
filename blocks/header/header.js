// Drop-in Tools
import { events } from '@dropins/tools/event-bus.js';

import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import {
  getMetadata,
  buildBlock,
  decorateBlock,
  loadBlock,
} from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { fetchPlaceholders, getProductLink, rootLink } from '../../scripts/commerce.js';

import renderAuthCombine from './renderAuthCombine.js';
import { renderAuthDropdown } from './renderAuthDropdown.js';
import renderSellerAssistedBuyingBanner from './renderSellerAssistedBuyingBanner.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

const labels = await fetchPlaceholders();

const overlay = document.createElement('div');
overlay.classList.add('overlay');
document.querySelector('header').insertAdjacentElement('afterbegin', overlay);

/**
 * Loads the nav fragment. Dual-fetch: local working copy first (aem up serves
 * /content/nav.plain.html), then the DA/EDS nav doc referenced in metadata.
 * @returns {Promise<HTMLElement>} the fragment root
 */
async function loadNavFragment() {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';

  // local dev / aem up
  let fragment = await loadFragment('/content/nav');
  if (fragment) return fragment;

  // DA / EDS production
  fragment = await loadFragment(navPath);
  return fragment;
}

/**
 * Normalizes a fragment logo <picture> to absolute media-da paths so the image
 * resolves under aem up regardless of the fragment base.
 * @param {Element} picture
 */
function normalizeLogoPaths(picture) {
  if (!picture) return;
  picture.querySelectorAll('source').forEach((source) => {
    const srcset = source.getAttribute('srcset');
    if (srcset && srcset.startsWith('media-da/')) source.setAttribute('srcset', `/${srcset}`);
  });
  const img = picture.querySelector('img');
  if (img) {
    const src = img.getAttribute('src');
    if (src && src.startsWith('media-da/')) img.setAttribute('src', `/${src}`);
  }
}

/**
 * Builds and loads the tfs-menu Commerce dropin block for the category nav row.
 * The dropin requires a `.tfs-menu` block element, which cannot live in the
 * class-free nav fragment, so it is constructed here.
 * @param {Element} container the category-nav band element
 */
async function buildCategoryMenu(container) {
  const block = buildBlock('tfs-menu', '');
  const wrapper = document.createElement('div');
  wrapper.append(block);
  container.append(wrapper);
  decorateBlock(block);
  await loadBlock(block);
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // Render a banner at the top of the page if seller assisted buying session identified
  const sellerAssistedBuyingBanner = await renderSellerAssistedBuyingBanner();
  if (sellerAssistedBuyingBanner && !document.querySelector('.seller-assisted-buying-banner')) {
    document.body.insertAdjacentElement('afterbegin', sellerAssistedBuyingBanner);
  }

  // load nav as fragment
  const fragment = await loadNavFragment();

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment && fragment.firstElementChild) nav.append(fragment.firstElementChild);

  // Fragment sections in order: 0 = logo, 1 = utility bar (2 lists), 2 = menu marker
  const [brandSection, utilitySection] = nav.children;

  /* ---------- Utility bar (top band) ---------- */
  const utilityBar = document.createElement('div');
  utilityBar.className = 'nav-utility';
  const utilityRight = document.createElement('div');
  utilityRight.className = 'nav-utility-right';
  if (utilitySection) {
    const lists = utilitySection.querySelectorAll(':scope .default-content-wrapper > ul, :scope > ul');
    const [promoList, contactList] = lists;
    const left = document.createElement('div');
    left.className = 'nav-utility-left';
    if (promoList) left.append(promoList);
    if (contactList) {
      // Add the map-pin icon to the "Our Stores" link
      const storesLink = [...contactList.querySelectorAll('a')].find((a) => /our stores/i.test(a.textContent));
      if (storesLink) storesLink.classList.add('nav-stores-link');
      utilityRight.append(contactList);
    }
    utilityBar.append(left, utilityRight);
    utilitySection.remove();
  }

  /* ---------- Brand / logo ---------- */
  const navBrand = document.createElement('div');
  navBrand.className = 'nav-brand';
  if (brandSection) {
    const picture = brandSection.querySelector('picture');
    normalizeLogoPaths(picture);
    const logoLink = document.createElement('a');
    logoLink.href = rootLink('/');
    logoLink.setAttribute('aria-label', 'The Futon Shop');
    if (picture) logoLink.append(picture);
    navBrand.append(logoLink);
    brandSection.remove();
  }

  // Remove any remaining fragment sections (e.g. the menu marker / metadata)
  [...nav.children].forEach((child) => {
    if (child.classList && child.classList.contains('section')) child.remove();
  });

  /* ---------- Live Chat link (left of main bar) ---------- */
  const liveChat = document.createRange().createContextualFragment(`
    <a class="nav-live-chat" href="https://www.thefutonshop.com/contact">
      <span class="nav-live-chat-icon" aria-hidden="true"></span>
      <span class="nav-live-chat-label">Live Chat</span>
    </a>
  `);

  /* ---------- Tools (wishlist / cart / account) — shown in utility bar ---------- */
  const navTools = document.createElement('div');
  navTools.className = 'nav-tools';
  utilityRight.append(navTools);

  /* ---------- Search box (visible input, right of logo) ---------- */
  const navSearch = document.createElement('div');
  navSearch.className = 'nav-search';

  /* ---------- Category nav band (tfs-menu dropin) ---------- */
  const navSections = document.createElement('div');
  navSections.className = 'nav-sections';

  /* ---------- Assemble main bar (live chat + logo + search) ---------- */
  const mainBar = document.createElement('div');
  mainBar.className = 'nav-main';
  const mainBarLeft = document.createElement('div');
  mainBarLeft.className = 'nav-main-left';
  mainBarLeft.append(liveChat);
  mainBar.append(mainBarLeft, navBrand, navSearch);

  nav.append(utilityBar, mainBar, navSections);

  /** Wishlist */
  const wishlist = document.createRange().createContextualFragment(`
     <div class="wishlist-wrapper nav-tools-wrapper">
       <button type="button" class="nav-wishlist-button" aria-label="Wishlist"></button>
       <div class="wishlist-panel nav-tools-panel"></div>
     </div>
   `);

  navTools.append(wishlist);

  const wishlistButton = navTools.querySelector('.nav-wishlist-button');

  const wishlistMeta = getMetadata('wishlist');
  const wishlistPath = wishlistMeta ? new URL(wishlistMeta, window.location).pathname : '/wishlist';

  wishlistButton.addEventListener('click', () => {
    window.location.href = rootLink(wishlistPath);
  });

  /** Mini Cart */
  const excludeMiniCartFromPaths = ['/checkout'];

  const minicart = document.createRange().createContextualFragment(`
     <div class="minicart-wrapper nav-tools-wrapper">
       <button type="button" class="nav-cart-button" aria-label="Cart" aria-haspopup="dialog" aria-expanded="false" aria-controls="minicart-panel"></button>
       <div class="minicart-panel nav-tools-panel" id="minicart-panel"></div>
       <div class="nav-cart-status" role="status" aria-live="polite"></div>
     </div>
   `);

  navTools.append(minicart);

  const minicartPanel = navTools.querySelector('.minicart-panel');

  const cartButton = navTools.querySelector('.nav-cart-button');

  // Kept mounted at all times so the item count change is reliably
  // announced instead of being missed, since the visual badge is a
  // `data-count` attribute rendered via CSS and isn't announced on its own.
  const cartStatus = navTools.querySelector('.nav-cart-status');

  if (excludeMiniCartFromPaths.includes(window.location.pathname)) {
    cartButton.style.display = 'none';
  }

  /**
   * Handles loading states for navigation panels with state management
   *
   * @param {HTMLElement} panel - The panel element to manage loading state for
   * @param {HTMLElement} button - The button that triggers the panel
   * @param {Function} loader - Async function to execute during loading
   */
  async function withLoadingState(panel, button, loader) {
    if (panel.dataset.loaded === 'true' || panel.dataset.loading === 'true') return;

    button.setAttribute('aria-busy', 'true');
    panel.dataset.loading = 'true';

    try {
      await loader();
      panel.dataset.loaded = 'true';
    } finally {
      panel.dataset.loading = 'false';
      button.removeAttribute('aria-busy');

      // Execute pending toggle if exists
      if (panel.dataset.pendingToggle === 'true') {
        // eslint-disable-next-line no-nested-ternary
        const pendingState = panel.dataset.pendingState === 'true' ? true : (panel.dataset.pendingState === 'false' ? false : undefined);

        // Clear pending flags
        panel.removeAttribute('data-pending-toggle');
        panel.removeAttribute('data-pending-state');

        // Execute the pending toggle
        const show = pendingState ?? !panel.classList.contains('nav-tools-panel--show');
        panel.classList.toggle('nav-tools-panel--show', show);
      }
    }
  }

  function togglePanel(panel, state) {
    // If loading is in progress, queue the toggle action
    if (panel.dataset.loading === 'true') {
      // Store the pending toggle action
      panel.dataset.pendingToggle = 'true';
      panel.dataset.pendingState = state !== undefined ? state.toString() : '';
      return;
    }

    const show = state ?? !panel.classList.contains('nav-tools-panel--show');
    panel.classList.toggle('nav-tools-panel--show', show);
  }

  // Lazy loading for mini cart fragment
  async function loadMiniCartFragment() {
    await withLoadingState(minicartPanel, cartButton, async () => {
      const miniCartMeta = getMetadata('mini-cart');
      const miniCartPath = miniCartMeta ? new URL(miniCartMeta, window.location).pathname : '/mini-cart';
      const miniCartFragment = await loadFragment(miniCartPath);
      minicartPanel.append(miniCartFragment.firstElementChild);
    });
  }

  async function toggleMiniCart(state) {
    if (state) {
      await loadMiniCartFragment();
      const { publishShoppingCartViewEvent } = await import('@dropins/storefront-cart/api.js');
      publishShoppingCartViewEvent();
    }

    togglePanel(minicartPanel, state);
    cartButton.setAttribute(
      'aria-expanded',
      minicartPanel.classList.contains('nav-tools-panel--show') ? 'true' : 'false',
    );
  }

  cartButton.addEventListener('click', () => toggleMiniCart(!minicartPanel.classList.contains('nav-tools-panel--show')));

  // Cart Item Counter
  let previousCartQuantity;

  events.on('cart/data', (data) => {
    // preload mini cart fragment if user has a cart
    if (data) loadMiniCartFragment();

    const totalQuantity = data?.totalQuantity ?? 0;

    if (totalQuantity) {
      cartButton.setAttribute('data-count', totalQuantity);
    } else {
      cartButton.removeAttribute('data-count');
    }

    // Skip the announcement for the initial value on page load so screen
    // reader users aren't told about the cart contents before they've
    // interacted with it; only announce actual changes.
    if (previousCartQuantity !== undefined && previousCartQuantity !== totalQuantity) {
      cartStatus.textContent = totalQuantity
        ? `Cart updated, ${totalQuantity} item${totalQuantity === 1 ? '' : 's'} in cart`
        : 'Cart updated, cart is empty';
    }

    previousCartQuantity = totalQuantity;
  }, { eager: true });

  /** Search — visible inline box in the main bar (matches the source) */
  const searchFragment = document.createRange().createContextualFragment(`
    <div class="search-wrapper">
      <form id="search-bar-form" role="search" aria-label="Search">
        <input type="search" name="search" class="nav-search-field" placeholder="Search Keywords..." autocomplete="off" aria-label="Search Keywords">
        <button type="submit" class="nav-search-button" aria-label="Search"></button>
      </form>
      <div class="nav-search-panel search-bar-result" style="display: none;"></div>
    </div>
  `);

  navSearch.append(searchFragment);

  const searchForm = navSearch.querySelector('#search-bar-form');
  const searchField = navSearch.querySelector('.nav-search-field');
  const searchResult = navSearch.querySelector('.search-bar-result');
  let searchInitialized = false;

  // Submit navigates to the results page regardless of dropin state.
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchField.value;
    if (query.length) {
      window.location.href = `${rootLink('/search')}?q=${encodeURIComponent(query)}`;
    }
  });

  // Lazily attach the autocomplete popover the first time the field is used.
  async function initSearch() {
    if (searchInitialized) return;
    searchInitialized = true;
    const pageSize = 4;

    await import('../../scripts/initializers/search.js');

    // Load search components in parallel
    const [
      { search },
      { render },
      { SearchResults },
      { provider: UI, Button },
    ] = await Promise.all([
      import('@dropins/storefront-product-discovery/api.js'),
      import('@dropins/storefront-product-discovery/render.js'),
      import('@dropins/storefront-product-discovery/containers/SearchResults.js'),
      import('@dropins/tools/components.js'),
      import('@dropins/tools/lib.js'),
    ]);

    render.render(SearchResults, {
      skeletonCount: pageSize,
      scope: 'popover',
      routeProduct: ({ urlKey, sku }) => getProductLink(urlKey, sku),
      onSearchResult: (results) => {
        searchResult.style.display = results.length > 0 ? 'block' : 'none';
      },
      slots: {
        ProductImage: (ctx) => {
          const { product, defaultImageProps } = ctx;
          const anchorWrapper = document.createElement('a');
          anchorWrapper.href = getProductLink(product.urlKey, product.sku);

          tryRenderAemAssetsImage(ctx, {
            alias: product.sku,
            imageProps: defaultImageProps,
            wrapper: anchorWrapper,
            params: {
              width: defaultImageProps.width,
              height: defaultImageProps.height,
            },
          });
        },
        Footer: async (ctx) => {
          // View all results button
          const viewAllResultsWrapper = document.createElement('div');

          const viewAllResultsButton = await UI.render(Button, {
            children: labels.Global?.SearchViewAll,
            variant: 'secondary',
            href: rootLink('/search'),
          })(viewAllResultsWrapper);

          ctx.appendChild(viewAllResultsWrapper);

          ctx.onChange((next) => {
            viewAllResultsButton?.setProps((prev) => ({
              ...prev,
              href: `${rootLink('/search')}?q=${encodeURIComponent(next.variables?.phrase || '')}`,
            }));
          });
        },
      },
    })(searchResult);

    // Drive the dropin autocomplete from the real input's value.
    const runSearch = (phrase) => {
      if (!phrase) {
        search(null, { scope: 'popover' });
        searchResult.style.display = 'none';
        return;
      }
      if (phrase.length < 3) return;
      search({
        phrase,
        pageSize,
        filter: [
          { attribute: 'visibility', in: ['Search', 'Catalog, Search'] },
        ],
      }, { scope: 'popover' });
    };

    searchField.addEventListener('input', () => runSearch(searchField.value.trim()));
    if (searchField.value.trim()) runSearch(searchField.value.trim());
  }

  searchField.addEventListener('focus', initSearch);

  // Close the autocomplete popover when clicking outside the search box
  document.addEventListener('click', (e) => {
    if (!navSearch.contains(e.target)) {
      searchResult.style.display = 'none';
    }
  });

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    // Check if undo is enabled for mini cart
    const miniCartElement = document.querySelector(
      '[data-block-name="commerce-mini-cart"]',
    );
    const undoEnabled = miniCartElement
      && (miniCartElement.textContent?.includes('undo-remove-item')
        || miniCartElement.innerHTML?.includes('undo-remove-item'));

    // For mini cart: if undo is enabled, be more restrictive about when to close
    const shouldCloseMiniCart = undoEnabled
      ? !minicartPanel.contains(e.target)
      && !cartButton.contains(e.target)
      && !e.target.closest('header')
      : !minicartPanel.contains(e.target) && !cartButton.contains(e.target);

    if (shouldCloseMiniCart) {
      toggleMiniCart(false);
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => {
    const expanded = nav.getAttribute('aria-expanded') === 'true';
    nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    navWrapper.classList.toggle('active', !expanded);
    overlay.classList.toggle('show', !expanded);
    document.body.style.overflowY = expanded || isDesktop.matches ? '' : 'hidden';
    hamburger.querySelector('button').setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  });
  mainBar.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');

  overlay.addEventListener('click', () => {
    nav.setAttribute('aria-expanded', 'false');
    navWrapper.classList.remove('active');
    overlay.classList.remove('show');
    document.body.style.overflowY = '';
  });

  // Close the mobile menu and reset state when crossing to desktop width
  isDesktop.addEventListener('change', () => {
    nav.setAttribute('aria-expanded', 'false');
    navWrapper.classList.remove('active');
    overlay.classList.remove('show');
    document.body.style.overflowY = '';
  });

  // Build the category menu (tfs-menu Commerce dropin) after the shell is in place.
  await buildCategoryMenu(navSections);

  renderAuthCombine(
    navTools,
    () => !isDesktop.matches,
  );
  renderAuthDropdown(navTools);
}
