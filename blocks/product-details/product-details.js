import {
  InLineAlert,
  Icon,
  Button,
  provider as UI,
} from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';
import { events } from '@dropins/tools/event-bus.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import * as pdpApi from '@dropins/storefront-pdp/api.js';
import { render as pdpRendered } from '@dropins/storefront-pdp/render.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';

import { WishlistAlert } from '@dropins/storefront-wishlist/containers/WishlistAlert.js';

// Containers
import ProductHeader from '@dropins/storefront-pdp/containers/ProductHeader.js';
import ProductShortDescription from '@dropins/storefront-pdp/containers/ProductShortDescription.js';
import ProductOptions from '@dropins/storefront-pdp/containers/ProductOptions.js';
import ProductQuantity from '@dropins/storefront-pdp/containers/ProductQuantity.js';
import ProductDescription from '@dropins/storefront-pdp/containers/ProductDescription.js';
import ProductGallery from '@dropins/storefront-pdp/containers/ProductGallery.js';
import ProductGiftCardOptions from '@dropins/storefront-pdp/containers/ProductGiftCardOptions.js';

// Libs
import {
  rootLink,
  setJsonLd,
  fetchPlaceholders,
  getProductLink,
  checkIsAuthenticated,
  CORE_FETCH_GRAPHQL,
} from '../../scripts/commerce.js';
import {
  showWishlistErrorToast,
  showWishlistLoginToast,
  showWishlistSuccessToast,
} from '../../scripts/components/tfs-wishlist-toast/tfs-wishlist-toast.js';
import { showWishlistAuthModal } from '../../scripts/wishlist-auth-modal.js';
import { getUserTokenCookie } from '../../scripts/initializers/index.js';

// Initializers
import { IMAGES_SIZES } from '../../scripts/initializers/pdp.js';
import '../../scripts/initializers/cart.js';
import '../../scripts/initializers/wishlist.js';
import {
  ensureProductImages,
  getPrimaryProductImageUrl,
  withProductImageFallback,
} from '../../scripts/product-image.js';
import {
  formatProductPrice,
  parseProductCardData,
} from '../../scripts/product-card.js';

/**
 * Checks if the page has prerendered product JSON-LD data
 * @returns {boolean} True if product JSON-LD exists and contains @type=Product
 */
function isProductPrerendered() {
  const jsonLdScript = document.querySelector('script[type="application/ld+json"]');

  if (!jsonLdScript?.textContent) {
    return false;
  }

  try {
    const jsonLd = JSON.parse(jsonLdScript.textContent);
    return jsonLd?.['@type'] === 'Product';
  } catch (error) {
    console.debug('Failed to parse JSON-LD:', error);
    return false;
  }
}

// Function to update the Add to Cart button text
function updateAddToCartButtonText(addToCartInstance, inCart, labels) {
  const buttonText = inCart
    ? labels.Global?.UpdateProductInCart
    : labels.Global?.AddProductToCart;
  if (addToCartInstance) {
    addToCartInstance.setProps((prev) => ({
      ...prev,
      children: buttonText,
    }));
  }
}

function updateStockBadge(stockEl, inStock, labels) {
  if (!stockEl) return;
  stockEl.classList.toggle('product-details__stock--available', inStock);
  stockEl.classList.toggle('product-details__stock--unavailable', !inStock);
  const label = inStock
    ? (labels.inStockLabel || 'In stock')
    : (labels.outOfStockLabel || 'Out of stock');
  stockEl.innerHTML = `<span>${label.toUpperCase()}</span>`;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

function updateTabVisibilities(block, product, hasFaqs) {
  if (!block) return;

  const descEl = block.querySelector('.product-details__description');
  const detailsText = stripHtml(product?.description || descEl?.textContent || '');
  const hasDetails = !!detailsText;

  const shortEl = block.querySelector('.product-details__short-description');
  const shortText = stripHtml(product?.shortDescription || shortEl?.textContent || '');
  const hasOverview = !!shortText && shortText.toLowerCase() !== (product?.name || '').toLowerCase();

  const faqContainer = block.querySelector('.product-details__faq-list');
  const faqItemsCount = faqContainer?.querySelectorAll('.faq-item')?.length || 0;
  const isFaqLoaded = hasFaqs !== undefined ? hasFaqs : faqItemsCount > 0;

  const tabConfigs = [
    { key: 'details', hasData: hasDetails },
    { key: 'overview', hasData: hasOverview },
    { key: 'faq', hasData: isFaqLoaded },
  ];

  let activeTabSet = false;

  tabConfigs.forEach(({ key, hasData }) => {
    const btn = block.querySelector(`#product-details-tab-btn-${key}`);
    const panel = block.querySelector(`#product-details-tab-${key}`);

    if (btn && panel) {
      if (!hasData) {
        btn.hidden = true;
        btn.classList.remove('is-active');
        btn.setAttribute('aria-selected', 'false');
        panel.hidden = true;
        panel.classList.remove('is-active');
      } else {
        btn.hidden = false;
        const currentActive = block.querySelector('.product-details__tab.is-active:not([hidden])');
        if (!activeTabSet && (!currentActive || currentActive === btn)) {
          activeTabSet = true;
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');
          panel.classList.add('is-active');
          panel.hidden = false;
        } else if (currentActive && currentActive === btn) {
          activeTabSet = true;
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');
          panel.classList.add('is-active');
          panel.hidden = false;
        } else {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-selected', 'false');
          panel.classList.remove('is-active');
          panel.hidden = true;
        }
      }
    }
  });

  const tabsContainer = block.querySelector('.product-details__tabs');
  if (tabsContainer) {
    tabsContainer.hidden = !tabConfigs.some((t) => t.hasData);
  }
}

function moveFaqIntoTab(block) {
  if (!block) return false;
  const faqTabPanel = block.querySelector('#product-details-tab-faq');
  if (!faqTabPanel) return false;

  const main = block.closest('main') || document.querySelector('main');
  if (!main) return false;

  const faqElement = main.querySelector('.faq-wrapper, .faq, [data-block-name="faq"]');
  if (!faqElement) return false;

  if (faqTabPanel.contains(faqElement)) return true;

  const parentSection = faqElement.closest('.section');
  const targetContainer = faqTabPanel.querySelector('.product-details__faq-list') || faqTabPanel;
  targetContainer.replaceChildren(faqElement);

  if (parentSection && parentSection !== faqTabPanel.closest('.section')) {
    const hasRemainingContent = [...parentSection.children].some(
      (child) => child.textContent.trim() !== '' && !child.classList.contains('section-metadata'),
    );
    if (!hasRemainingContent) {
      parentSection.style.display = 'none';
    }
  }

  return true;
}

function setupFaqTabIntegration(block, onFaqMoved) {
  const moved = moveFaqIntoTab(block);
  if (moved) {
    onFaqMoved(true);
    return;
  }

  const main = block.closest('main') || document.querySelector('main');
  if (!main) {
    onFaqMoved(false);
    return;
  }

  const observer = new MutationObserver(() => {
    if (moveFaqIntoTab(block)) {
      onFaqMoved(true);
      observer.disconnect();
    }
  });

  observer.observe(main, { childList: true, subtree: true });

  setTimeout(() => {
    observer.disconnect();
    onFaqMoved(moveFaqIntoTab(block));
  }, 2000);
}

function isRequiredOption(opt) {
  if (!opt) return false;
  if (opt.required === true) return true;
  if (opt.typename === 'ProductViewOptionValueConfiguration') return true;

  const items = opt.items || opt.values || [];
  if (items.some((v) => v.__typename === 'ProductViewOptionValueConfiguration' || v.typename === 'ProductViewOptionValueConfiguration')) {
    return true;
  }

  const isOptionalCustomOption = opt.required === false && (
    opt.typename === 'ProductViewOptionValueProduct'
    || opt.typename === 'ProductViewOptionValueCustom'
    || items.some((v) => v.__typename === 'ProductViewOptionValueProduct'
      || v.typename === 'ProductViewOptionValueProduct'
      || v.__typename === 'ProductViewOptionValueCustom'
      || v.typename === 'ProductViewOptionValueCustom')
  );

  if (isOptionalCustomOption) {
    return false;
  }

  return true;
}

function decorateOptionLabels(optionsContainer, optionsData) {
  if (!optionsContainer || !optionsData?.length) return;

  const fieldLabels = [...optionsContainer.querySelectorAll(
    '.pdp-swatches__field__label, .dropin-field__label, .dropin-picker__label, label',
  )];

  optionsData.forEach((opt) => {
    const isRequired = isRequiredOption(opt);

    let targetField = optionsContainer.querySelector(`#swatch-item-${opt.id}`)
      || optionsContainer.querySelector(`[data-slot-key="product-swatch--${opt.id}"]`);

    let targetLabel = targetField?.querySelector(
      '.pdp-swatches__field__label, .dropin-field__label, .dropin-picker__label, label',
    );

    if (!targetLabel) {
      targetLabel = fieldLabels.find((lbl) => {
        const text = lbl.textContent || '';
        const title = opt.title || opt.label || '';
        return title && text.toLowerCase().includes(title.toLowerCase());
      });
      if (targetLabel) {
        targetField = targetLabel.closest('.pdp-swatches__field, .dropin-field, .dropin-picker');
      }
    }

    if (targetLabel) {
      targetLabel.classList.toggle('product-details__required-label', isRequired);
      const reqSpan = targetLabel.querySelector('.product-details__required');
      if (reqSpan) {
        reqSpan.remove();
      }
    }

    if (targetField) {
      targetField.classList.toggle('product-details__field--required', isRequired);
    }
  });
}

function layoutHeaderMeta(headerEl, wishlistEl) {
  const pdpHeader = headerEl?.querySelector('.pdp-header');
  const sku = pdpHeader?.querySelector('.pdp-header__sku');
  if (!pdpHeader || !sku || !wishlistEl) return;

  let meta = pdpHeader.querySelector('.product-details__header-meta');
  if (!meta) {
    meta = document.createElement('div');
    meta.className = 'product-details__header-meta';
    pdpHeader.append(meta);
  }
  meta.replaceChildren(sku, wishlistEl);
}

function initPdpTabs(block) {
  const tabList = block.querySelector('.product-details__tab-list');
  if (!tabList) return;

  const getVisibleTabs = () => [...tabList.querySelectorAll('[role="tab"]:not([hidden])')];
  const getPanels = () => [...block.querySelectorAll('.product-details__tab-panel')];

  const activateTab = (activeTab) => {
    const target = activeTab.dataset.tab;
    const tabs = getVisibleTabs();
    const panels = getPanels();
    tabs.forEach((tab) => {
      const isActive = tab === activeTab;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.classList.toggle('is-active', isActive);
      tab.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach((panel) => {
      const isActive = panel.dataset.tab === target;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
  };

  tabList.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]:not([hidden])');
    if (tab && tabList.contains(tab)) {
      activateTab(tab);
    }
  });

  tabList.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[role="tab"]:not([hidden])');
    if (!tab) return;
    const tabs = getVisibleTabs();
    const index = tabs.indexOf(tab);
    if (index === -1) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = tabs[(index + 1) % tabs.length];
      activateTab(next);
      next.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = tabs[(index - 1 + tabs.length) % tabs.length];
      activateTab(prev);
      prev.focus();
    }
  });
}

function computeSavePercent(finalPrice, regularPrice) {
  if (
    typeof finalPrice === 'number'
    && typeof regularPrice === 'number'
    && regularPrice > finalPrice
    && regularPrice > 0
  ) {
    return Math.round(((regularPrice - finalPrice) / regularPrice) * 100);
  }
  return undefined;
}

function parsePdpPricingData(product) {
  const prices = product?.prices;
  if (prices?.visible !== false && prices?.final) {
    const finalAmount = prices.final.minimumAmount ?? prices.final.amount;
    const regularAmount = prices.regular?.minimumAmount ?? prices.regular?.amount;
    const currency = prices.final.currency ?? prices.regular?.currency ?? 'USD';
    const finalPrice = typeof finalAmount === 'number' ? finalAmount : undefined;
    const regularPrice = typeof regularAmount === 'number' ? regularAmount : undefined;
    const hasRange = prices.final.minimumAmount != null
      && prices.final.maximumAmount != null
      && prices.final.minimumAmount !== prices.final.maximumAmount;

    return {
      finalPrice,
      regularPrice,
      currency,
      isOnSale: typeof finalPrice === 'number'
        && typeof regularPrice === 'number'
        && regularPrice > finalPrice,
      isPriceRange: hasRange,
      savePercent: computeSavePercent(finalPrice, regularPrice),
    };
  }

  return parseProductCardData(product);
}

function renderPdpPricing(priceEl, product, labels) {
  if (!priceEl || !product) return;
  priceEl.replaceChildren();

  const data = parsePdpPricingData(product);
  if (typeof data.finalPrice !== 'number') return;

  const pricing = document.createElement('div');
  pricing.className = 'product-details__pricing';

  const row = document.createElement('div');
  row.className = 'product-details__price-row';

  if (data.isPriceRange) {
    const from = document.createElement('span');
    from.className = 'product-details__from';
    from.textContent = `${labels.fromLabel || 'From'}:`;
    row.appendChild(from);
  }

  const final = document.createElement('span');
  final.className = `product-details__final${data.isOnSale ? ' product-details__final--sale' : ''}`;
  final.textContent = formatProductPrice(data.finalPrice, data.currency);
  row.appendChild(final);

  if (data.isOnSale && typeof data.regularPrice === 'number') {
    const regular = document.createElement('span');
    regular.className = 'product-details__regular';
    regular.textContent = formatProductPrice(data.regularPrice, data.currency);
    row.appendChild(regular);
  }

  if (data.savePercent && data.savePercent > 0) {
    const save = document.createElement('span');
    save.className = 'product-details__save';
    save.textContent = (labels.saveLabel || 'Save {percent}%')
      .replace('{percent}', String(data.savePercent));
    row.appendChild(save);
  }

  pricing.appendChild(row);
  priceEl.appendChild(pricing);
}

function syncWishlistAuthHeaders(wishlistApi) {
  const token = getUserTokenCookie();
  if (checkIsAuthenticated() && token) {
    wishlistApi.setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
  } else {
    wishlistApi.removeFetchGraphQlHeader('Authorization');
  }
}

function updatePdpWishlistButton(btn, wishlistApi) {
  if (!btn) return;
  const values = pdpApi.getProductConfigurationValues();
  const sku = values?.sku || events.lastPayload('pdp/data')?.sku;
  if (!sku || !checkIsAuthenticated()) {
    btn.classList.remove('is-active');
    btn.setAttribute('aria-pressed', 'false');
    return;
  }
  const inWishlist = !!wishlistApi.findInPersistedAllWishlistItems(sku);
  btn.classList.toggle('is-active', inWishlist);
  btn.setAttribute('aria-pressed', inWishlist ? 'true' : 'false');
}

async function setupPdpWishlist(wishlistEl) {
  const wishlistApi = await import('@dropins/storefront-wishlist/api.js');
  wishlistApi.setEndpoint(CORE_FETCH_GRAPHQL);
  syncWishlistAuthHeaders(wishlistApi);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'product-details__wishlist-btn';
  btn.setAttribute('aria-label', 'Add to wishlist');
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<span class="product-details__wishlist-icon" aria-hidden="true"></span>';
  wishlistEl.replaceChildren(btn);

  const resync = () => updatePdpWishlistButton(btn, wishlistApi);

  btn.addEventListener('click', async () => {
    const productData = events.lastPayload('pdp/data');
    const values = pdpApi.getProductConfigurationValues();
    const sku = values?.sku || productData?.sku;
    if (!sku) return;

    if (!checkIsAuthenticated()) {
      showWishlistLoginToast(() => {
        showWishlistAuthModal();
      });
      return;
    }

    syncWishlistAuthHeaders(wishlistApi);
    const existing = wishlistApi.findInPersistedAllWishlistItems(sku);
    const isRemove = !!existing;

    btn.disabled = true;
    try {
      if (isRemove) {
        await wishlistApi.removeProductsFromWishlist([existing]);
      } else {
        await wishlistApi.addProductsToWishlist([{
          sku,
          quantity: values?.quantity || 1,
          optionsUIDs: values?.optionsUIDs,
        }]);
      }
      resync();
      await showWishlistSuccessToast(isRemove ? 'remove' : 'add', productData?.name || sku);
    } catch (error) {
      await showWishlistErrorToast(error instanceof Error ? error.message : undefined);
    } finally {
      btn.disabled = false;
    }
  });

  events.on('wishlist/data', resync);
  events.on('pdp/data', resync, { eager: true });
  events.on('pdp/values', resync, { eager: true });
  events.on('authenticated', () => {
    syncWishlistAuthHeaders(wishlistApi);
    resync();
  });

  resync();
  return btn;
}

export default async function decorate(block) {
  const eventProduct = events.lastPayload('pdp/data') ?? null;
  // bug: the pdp sends an object with event data even if product is not found.
  const product = eventProduct?.sku ? eventProduct : null;

  const labels = await fetchPlaceholders();

  // Read itemUid from URL
  const urlParams = new URLSearchParams(window.location.search);
  const itemUidFromUrl = urlParams.get('itemUid');

  // State to track if we are in update mode
  let isUpdateMode = false;

  // State to track if the current product/variant is out of stock
  let isOutOfStock = false;

  // Layout
  const fragment = document.createRange().createContextualFragment(`
    <div class="product-details__alert"></div>
    <div class="product-details__wrapper">
      <div class="product-details__left-column">
        <div class="product-details__gallery"></div>
      </div>
      <div class="product-details__right-column">
        <div class="product-details__stock" aria-live="polite"></div>
        <div class="product-details__header"></div>
        <div class="product-details__price"></div>
        <div class="product-details__gallery"></div>
        <div class="product-details__gift-card-options"></div>
        <div class="product-details__configuration">
          <div class="product-details__options"></div>
          <div class="product-details__purchase-row">
            <div class="product-details__quantity"></div>
            <div class="product-details__buttons">
              <div class="product-details__buttons__add-to-cart"></div>
            </div>
          </div>
          <div class="product-details__add-to-cart-status" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>
    <div class="product-details__tabs">
      <div class="product-details__tab-list" role="tablist" aria-label="Product information">
        <button type="button" role="tab" id="product-details-tab-btn-details"
          aria-controls="product-details-tab-details" aria-selected="true"
          class="product-details__tab is-active" data-tab="details">Details</button>
        <button type="button" role="tab" id="product-details-tab-btn-overview"
          aria-controls="product-details-tab-overview" aria-selected="false"
          class="product-details__tab" data-tab="overview">Overview</button>
        <button type="button" role="tab" id="product-details-tab-btn-faq"
          aria-controls="product-details-tab-faq" aria-selected="false"
          class="product-details__tab" data-tab="faq">FAQ</button>
      </div>
      <div class="product-details__tab-panels">
        <div id="product-details-tab-details" role="tabpanel"
          class="product-details__tab-panel is-active" data-tab="details"
          aria-labelledby="product-details-tab-btn-details">
          <div class="product-details__description"></div>
        </div>
        <div id="product-details-tab-overview" role="tabpanel"
          class="product-details__tab-panel" data-tab="overview"
          aria-labelledby="product-details-tab-btn-overview" hidden>
          <div class="product-details__short-description"></div>
        </div>
        <div id="product-details-tab-faq" role="tabpanel"
          class="product-details__tab-panel" data-tab="faq"
          aria-labelledby="product-details-tab-btn-faq" hidden>
          <div class="product-details__faq-list"></div>
        </div>
      </div>
    </div>
  `);

  const $alert = fragment.querySelector('.product-details__alert');
  const $gallery = fragment.querySelector('.product-details__left-column .product-details__gallery');
  const $header = fragment.querySelector('.product-details__header');
  const $stock = fragment.querySelector('.product-details__stock');
  const $price = fragment.querySelector('.product-details__price');
  const $galleryMobile = fragment.querySelector('.product-details__right-column .product-details__gallery');
  const $shortDescription = fragment.querySelector('.product-details__short-description');
  const $options = fragment.querySelector('.product-details__options');
  const $quantity = fragment.querySelector('.product-details__quantity');
  const $giftCardOptions = fragment.querySelector('.product-details__gift-card-options');
  const $addToCart = fragment.querySelector('.product-details__buttons__add-to-cart');
  const $addToCartStatus = fragment.querySelector('.product-details__add-to-cart-status');
  const $description = fragment.querySelector('.product-details__description');
  const $wishlistHost = document.createElement('div');
  $wishlistHost.className = 'product-details__wishlist';

  block.replaceChildren(fragment);
  block.append($wishlistHost);

  const gallerySlots = {
    CarouselThumbnail: (ctx) => {
      if (ctx.mediaType === 'image') {
        tryRenderAemAssetsImage(ctx, {
          ...imageSlotConfig(ctx),
          wrapper: document.createElement('span'),
        });
      }
    },

    CarouselMainImage: (ctx) => {
      if (ctx.mediaType === 'image') {
        tryRenderAemAssetsImage(ctx, {
          ...imageSlotConfig(ctx),
        });
      }
    },
  };

  // Alert
  let inlineAlert = null;
  const routeToWishlist = rootLink('/wishlist');

  const [
    _galleryMobile,
    _gallery,
    _header,
    _shortDescription,
    _options,
    _quantity,
    _giftCardOptions,
    _description,
  ] = await Promise.all([
    // Gallery (Mobile)
    pdpRendered.render(ProductGallery, {
      controls: 'dots',
      arrows: true,
      peak: false,
      gap: 'small',
      loop: false,
      videos: true, // Display videos if available
      imageParams: {
        ...IMAGES_SIZES,
      },

      slots: gallerySlots,
    })($galleryMobile),

    // Gallery (Desktop) — main image with thumbnail row below (TFS reference)
    pdpRendered.render(ProductGallery, {
      controls: 'thumbnailsRow',
      arrows: true,
      peak: false,
      gap: 'small',
      loop: false,
      videos: true,
      imageParams: {
        ...IMAGES_SIZES,
      },

      slots: gallerySlots,
    })($gallery),

    // Header
    pdpRendered.render(ProductHeader, {})($header),

    // Short Description
    pdpRendered.render(ProductShortDescription, {})($shortDescription),

    // Configuration - Swatches
    pdpRendered.render(ProductOptions, {
      hideSelectedValue: false,
      slots: {
        SwatchImage: (ctx) => {
          tryRenderAemAssetsImage(ctx, {
            ...imageSlotConfig(ctx),
            wrapper: document.createElement('span'),
          });
        },
      },
    })($options),

    // Configuration  Quantity
    pdpRendered.render(ProductQuantity, {})($quantity),

    // Configuration  Gift Card Options
    pdpRendered.render(ProductGiftCardOptions, {})($giftCardOptions),

    // Description
    pdpRendered.render(ProductDescription, {})($description),
  ]);

  await setupPdpWishlist($wishlistHost);
  layoutHeaderMeta($header, $wishlistHost);
  initPdpTabs(block);

  let hasFaqsLoaded = false;
  setupFaqTabIntegration(block, (hasFaqs) => {
    hasFaqsLoaded = hasFaqs;
    updateTabVisibilities(block, product || events.lastPayload('pdp/data'), hasFaqsLoaded);
  });

  if (product) {
    updateStockBadge($stock, product.inStock !== false, labels);
    renderPdpPricing($price, product, labels);
    updateTabVisibilities(block, product, hasFaqsLoaded);
  }

  // Configuration – Button - Add to Cart
  const addToCart = await UI.render(Button, {
    children: labels.Global?.AddProductToCart || 'Add to Cart',
    onClick: async () => {
      const buttonActionText = isUpdateMode
        ? labels.Global?.UpdatingInCart
        : labels.Global?.AddingToCart;
      try {
        // Validation check for required options
        const productData = events.lastPayload('pdp/data');
        const options = productData?.options || [];
        const requiredOptions = options.filter((opt) => isRequiredOption(opt));

        const values = pdpApi.getProductConfigurationValues();
        const selectedUids = values?.optionsUIDs || [];

        const missingRequired = requiredOptions.filter((opt) => {
          const items = opt.items || opt.values || [];
          if (!items || !items.length) return false;
          return !items.some((v) => selectedUids.includes(v.id));
        });

        if (missingRequired.length > 0) {
          const desc = missingRequired.length === 1
            ? 'You need to choose options for your item.'
            : 'You need to choose required options for your item.';

          inlineAlert?.remove();
          inlineAlert = await UI.render(InLineAlert, {
            heading: 'Required Selection Missing',
            description: desc,
            icon: h(Icon, { source: 'Warning' }),
            'aria-live': 'assertive',
            role: 'alert',
            onDismiss: () => {
              inlineAlert.remove();
            },
          })($alert);

          $alert.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          return;
        }

        // Reset any existing alert if validation passes
        inlineAlert?.remove();

        addToCart.setProps((prev) => ({
          ...prev,
          children: buttonActionText,
          disabled: true,
        }));
        $addToCartStatus.textContent = buttonActionText ?? 'Adding to Cart';

        // add or update the product in the cart
        if (isUpdateMode) {
          // --- Update existing item ---
          const { updateProductsFromCart } = await import(
            '@dropins/storefront-cart/api.js'
          );

          await updateProductsFromCart([{ ...values, uid: itemUidFromUrl }]);

          // --- START REDIRECT ON UPDATE ---
          const updatedSku = values?.sku;
          if (updatedSku) {
            const cartRedirectUrl = new URL(
              rootLink('/cart'),
              window.location.origin,
            );
            cartRedirectUrl.searchParams.set('itemUid', itemUidFromUrl);
            window.location.href = cartRedirectUrl.toString();
          } else {
            // Fallback if SKU is somehow missing (shouldn't happen in normal flow)
            console.warn(
              'Could not retrieve SKU for updated item. Redirecting to cart without parameter.',
            );
            window.location.href = rootLink('/cart');
          }
          return;
        }

        // --- Add new item ---
        const { addProductsToCart } = await import(
          '@dropins/storefront-cart/api.js'
        );
        await addProductsToCart([{ ...values }]);

        // Render success alert
        inlineAlert?.remove();
        inlineAlert = await UI.render(InLineAlert, {
          heading: 'Added to Cart',
          description: `${productData?.name || 'Item'} has been successfully added to your cart.`,
          type: 'success',
          icon: h(Icon, { source: 'Check' }),
          'aria-live': 'polite',
          role: 'status',
          onDismiss: () => {
            inlineAlert?.remove();
          },
        })($alert);

        $alert.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } catch (error) {
        // add alert message
        inlineAlert = await UI.render(InLineAlert, {
          heading: 'Error',
          description: error.message,
          icon: h(Icon, { source: 'Warning' }),
          'aria-live': 'assertive',
          role: 'alert',
          onDismiss: () => {
            inlineAlert.remove();
          },
        })($alert);

        // Scroll the alertWrapper into view
        $alert.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } finally {
        // Reset button text using the helper function which respects the current mode
        updateAddToCartButtonText(addToCart, isUpdateMode, labels);
        // Re-enable button, unless the current variant is out of stock
        addToCart.setProps((prev) => ({
          ...prev,
          disabled: isOutOfStock,
        }));
        $addToCartStatus.textContent = '';
      }
    },
  })($addToCart);

  const optionsObserver = new MutationObserver(() => {
    const optionsData = events.lastPayload('pdp/data')?.options;
    if (optionsData) {
      decorateOptionLabels($options, optionsData);
    }
  });
  optionsObserver.observe($options, { childList: true, subtree: true });

  // Lifecycle Events
  events.on('pdp/data', (data) => {
    ensureProductImages(data);
    isOutOfStock = data?.inStock === false;
    updateStockBadge($stock, !isOutOfStock, labels);
    renderPdpPricing($price, data, labels);
    updateTabVisibilities(block, data, hasFaqsLoaded);
    addToCart.setProps((prev) => ({ ...prev, disabled: isOutOfStock }));
    decorateOptionLabels($options, data?.options);
  }, { eager: true });

  events.on('pdp/valid', () => {
    // Keep add to cart button enabled unless out of stock; validation occurs on click
    addToCart.setProps((prev) => ({ ...prev, disabled: isOutOfStock }));
  }, { eager: true });

  events.on('pdp/values', () => {
    const optionsData = events.lastPayload('pdp/data')?.options;
    if (optionsData) {
      decorateOptionLabels($options, optionsData);
    }
  }, { eager: true });

  // Handle option changes — wishlist syncs via pdp/values listener in setupPdpWishlist

  events.on('wishlist/alert', ({ action, item }) => {
    wishlistRender.render(WishlistAlert, {
      action,
      item,
      routeToWishlist,
    })($alert);

    setTimeout(() => {
      $alert.innerHTML = '';
    }, 5000);

    setTimeout(() => {
      $alert.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 0);
  });

  // --- Add new event listener for cart/data ---
  events.on(
    'cart/data',
    (cartData) => {
      let itemIsInCart = false;
      if (itemUidFromUrl && cartData?.items) {
        itemIsInCart = cartData.items.some(
          (item) => item.uid === itemUidFromUrl,
        );
      }
      // Set the update mode state
      isUpdateMode = itemIsInCart;

      // Update button text based on whether the item is in the cart
      updateAddToCartButtonText(addToCart, itemIsInCart, labels);
    },
    { eager: true },
  );

  // Set JSON-LD and Meta Tags
  events.on('aem/lcp', () => {
    const isPrerendered = isProductPrerendered();
    if (product && !isPrerendered) {
      setJsonLdProduct(product);
      setMetaTags(product);
      document.title = product.name;
    }
  }, { eager: true });

  return Promise.resolve();
}

async function setJsonLdProduct(product) {
  const {
    name,
    inStock,
    description,
    sku,
    urlKey,
    price,
    priceRange,
    attributes,
  } = product;
  const amount = priceRange?.minimum?.final?.amount || price?.final?.amount;
  const brand = attributes?.find((attr) => attr.name === 'brand');

  // get variants
  const { data } = await pdpApi.fetchGraphQl(`
    query GET_PRODUCT_VARIANTS($sku: String!) {
      variants(sku: $sku) {
        variants {
          product {
            sku
            name
            inStock
            images(roles: ["image"]) {
              url
            }
            ...on SimpleProductView {
              price {
                final { amount { currency value } }
              }
            }
          }
        }
      }
    }
  `, {
    method: 'GET',
    variables: { sku },
  });

  const variants = data?.variants?.variants || [];

  const ldJson = {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name,
    description,
    image: getPrimaryProductImageUrl(product),
    offers: [],
    productID: sku,
    brand: {
      '@type': 'Brand',
      name: brand?.value,
    },
    url: new URL(getProductLink(urlKey, sku), window.location),
    sku,
    '@id': new URL(getProductLink(urlKey, sku), window.location),
  };

  if (variants.length > 1) {
    ldJson.offers.push(...variants
      // A variant can come back without a resolved product (e.g. an
      // unavailable option combination); skip those so JSON-LD generation
      // doesn't throw on null property access.
      .filter((variant) => variant.product)
      .map((variant) => ({
        '@type': 'Offer',
        name: variant.product.name,
        image: variant.product.images?.[0]?.url,
        price: variant.product.price?.final?.amount?.value,
        priceCurrency: variant.product.price?.final?.amount?.currency,
        availability: variant.product.inStock ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
        sku: variant.product.sku,
      })));
  } else {
    ldJson.offers.push({
      '@type': 'Offer',
      price: amount?.value,
      priceCurrency: amount?.currency,
      availability: inStock ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
    });
  }

  setJsonLd(ldJson, 'product');
}

function createMetaTag(property, content, type) {
  if (!property || !type) {
    return;
  }
  let meta = document.head.querySelector(`meta[${type}="${property}"]`);
  if (meta) {
    if (!content) {
      meta.remove();
      return;
    }
    meta.setAttribute(type, property);
    meta.setAttribute('content', content);
    return;
  }
  if (!content) {
    return;
  }
  meta = document.createElement('meta');
  meta.setAttribute(type, property);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

function setMetaTags(product) {
  if (!product?.sku) {
    return;
  }

  const price = product.prices.final.minimumAmount ?? product.prices.final.amount;

  createMetaTag('title', product.metaTitle || product.name, 'name');
  createMetaTag('description', product.metaDescription, 'name');
  createMetaTag('keywords', product.metaKeyword, 'name');

  createMetaTag('og:type', 'product', 'property');
  createMetaTag('og:description', product.shortDescription, 'property');
  createMetaTag('og:title', product.metaTitle || product.name, 'property');
  createMetaTag('og:url', window.location.href, 'property');
  const mainImage = product?.images?.filter((image) => image.roles.includes('thumbnail'))[0];
  const metaImage = mainImage?.url || getPrimaryProductImageUrl(product);
  createMetaTag('og:image', metaImage, 'property');
  createMetaTag('og:image:secure_url', metaImage, 'property');
  createMetaTag('product:price:amount', price.value, 'property');
  createMetaTag('product:price:currency', price.currency, 'property');
}

/**
 * Returns the configuration for an image slot.
 * Ensures params include both width and height so srcset URLs are valid.
 * @param ctx - The context of the slot.
 * @returns The configuration for the image slot.
 */
function imageSlotConfig(ctx) {
  const { data, defaultImageProps } = ctx;
  const imageProps = withProductImageFallback(defaultImageProps, data);
  const { width, height } = imageProps;
  return {
    alias: data.sku,
    imageProps: {
      ...imageProps,
      width,
      height,
      params: {
        ...imageProps.params,
        width,
        height,
      },
    },
    params: {
      width,
      height,
    },
  };
}
