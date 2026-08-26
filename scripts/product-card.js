/**
 * TFS product card DOM for dropin ProductItemCard surfaces (PLP, search, etc.).
 * Markup and class names match @ajay0641/tfs-product-slider ProductCard.
 */

import { createWishlistIcon } from './tfs-product-card-icons.js';

const CARD = 'tfsproductslider-product-card';

/**
 * @param {Array<{name?: string, value?: unknown}>|undefined} attributes
 * @param {string[]} names
 */
function getAttributeValue(attributes, names) {
  if (!attributes?.length) return undefined;
  const normalized = names.map((n) => n.toLowerCase());
  const match = attributes.find(
    (attr) => attr?.name && normalized.includes(attr.name.toLowerCase()),
  );
  return match?.value;
}

/** @param {unknown} value */
function parseNumber(value) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** @param {{amount?: {value?: number, currency?: string}}|undefined} price */
function extractPriceAmount(price) {
  const finalPrice = price?.final?.amount?.value;
  const regularPrice = price?.regular?.amount?.value;
  const currency = price?.final?.amount?.currency
    ?? price?.regular?.amount?.currency
    ?? 'USD';
  return { finalPrice, regularPrice, currency };
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

/** @param {string} html */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

/** @param {object} product */
export function parseProductCardData(product) {
  const isComplex = product.typename === 'ComplexProductView' || !!product.priceRange;
  const minPrice = extractPriceAmount(
    isComplex ? product.priceRange?.minimum : product.price,
  );
  const maxPrice = isComplex
    ? extractPriceAmount(product.priceRange?.maximum)
    : minPrice;

  const finalPrice = minPrice.finalPrice ?? maxPrice.finalPrice;
  const regularPrice = minPrice.regularPrice ?? maxPrice.regularPrice;
  const currency = minPrice.currency ?? maxPrice.currency ?? 'USD';

  let rating = parseNumber(getAttributeValue(product.attributes, ['rating_summary', 'rating']));
  if (rating != null && rating > 5) {
    rating = Math.min(5, rating / 20);
  }

  const reviewCount = parseNumber(
    getAttributeValue(product.attributes, ['review_count', 'reviews_count']),
  );

  const subtitleRaw = getAttributeValue(
    product.attributes,
    ['short_description', 'subtitle', 'brand', 'manufacturer'],
  );
  const subtitle = subtitleRaw ? stripHtml(String(subtitleRaw)) : undefined;

  return {
    finalPrice,
    regularPrice,
    currency,
    isOnSale: typeof finalPrice === 'number'
      && typeof regularPrice === 'number'
      && regularPrice > finalPrice,
    isPriceRange: isComplex,
    savePercent: computeSavePercent(finalPrice, regularPrice),
    rating,
    reviewCount,
    subtitle,
    addToCartAllowed: product.addToCartAllowed,
    inStock: product.inStock,
  };
}

/** @param {number} amount @param {string} [currency='USD'] */
export function formatProductPrice(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** @param {string} className */
function createCartIcon(className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  [
    'M3 4h1.5l1.2 2.2',
    'M5.5 6.2h13.2l-1.3 8.3H7.2L5.5 6.2z',
    'M7.2 14.5h10.2',
  ].forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
  [{ cx: '9', cy: '18.5' }, { cx: '16', cy: '18.5' }].forEach(({ cx, cy }) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', '1.35');
    svg.appendChild(circle);
  });
  return svg;
}

/** @param {number} rating */
function buildStars(rating) {
  const stars = document.createElement('span');
  stars.className = `${CARD}__stars`;
  stars.setAttribute('aria-hidden', 'true');
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  for (let i = 0; i < 5; i += 1) {
    const star = document.createElement('span');
    star.className = `${CARD}__star${i < filled ? ` ${CARD}__star--filled` : ''}`;
    star.textContent = '★';
    stars.appendChild(star);
  }
  return stars;
}

/** @param {object} data @param {object} labels @param {string} productHref */
function buildReviews(data, labels, productHref) {
  const hasRating = typeof data.rating === 'number' && data.rating > 0;
  const hasReviews = typeof data.reviewCount === 'number' && data.reviewCount > 0;
  if (!hasRating && !hasReviews) return null;

  const reviews = document.createElement('div');
  reviews.className = `${CARD}__reviews`;
  if (hasRating) reviews.appendChild(buildStars(data.rating));
  if (hasReviews) {
    const countLabel = data.reviewCount === 1
      ? (labels.reviewLabel || '{count} Review').replace('{count}', String(data.reviewCount))
      : (labels.reviewsLabel || '{count} Reviews').replace('{count}', String(data.reviewCount));
    const link = document.createElement('a');
    link.className = `${CARD}__review-count`;
    link.href = productHref;
    link.textContent = countLabel;
    reviews.appendChild(link);
  }
  return reviews;
}

/** @param {object} data @param {object} labels */
function buildPricing(data, labels) {
  if (typeof data.finalPrice !== 'number') return null;

  const pricing = document.createElement('div');
  pricing.className = `${CARD}__pricing`;

  const row = document.createElement('div');
  row.className = `${CARD}__price-row`;

  const from = document.createElement('span');
  from.className = `${CARD}__from`;
  from.textContent = labels.fromLabel || 'From:';
  row.appendChild(from);

  if (data.isOnSale && typeof data.regularPrice === 'number') {
    const regular = document.createElement('span');
    regular.className = `${CARD}__regular`;
    regular.textContent = formatProductPrice(data.regularPrice, data.currency);
    row.appendChild(regular);
  }

  const final = document.createElement('span');
  final.className = `${CARD}__final`;
  final.textContent = formatProductPrice(data.finalPrice, data.currency);
  row.appendChild(final);
  pricing.appendChild(row);

  if (data.savePercent && data.savePercent > 0) {
    const save = document.createElement('p');
    save.className = `${CARD}__save`;
    save.textContent = (labels.saveLabel || 'Save up to {percent}%')
      .replace('{percent}', String(data.savePercent));
    pricing.appendChild(save);
  }

  return pricing;
}

/**
 * @param {object} options
 * @param {object} options.product
 * @param {(product: object) => string} options.routeProduct
 * @param {object} [options.labels]
 * @param {(product: object) => boolean} [options.requiresPdpConfiguration]
 * @param {(product: object, button: HTMLElement) => void} [options.onAddToCartClick]
 * @param {(product: object, button: HTMLElement) => void} [options.onWishlistClick]
 */
function buildActions({
  product,
  routeProduct,
  labels = {},
  requiresPdpConfiguration = () => false,
  onAddToCartClick,
  onWishlistClick,
}) {
  const actions = document.createElement('div');
  actions.className = `${CARD}__actions`;
  const productName = product.name || product.sku;
  const productHref = routeProduct(product);
  const needsConfig = requiresPdpConfiguration(product);

  if (typeof onAddToCartClick === 'function') {
    const addToCartLabel = `${labels.addToCartLabel || 'Add to cart'} ${productName}`;
    if (needsConfig) {
      const link = document.createElement('a');
      link.className = `${CARD}__action-btn ${CARD}__atc`;
      link.href = productHref;
      link.setAttribute('aria-label', addToCartLabel);
      link.appendChild(createCartIcon(`${CARD}__action-btn-icon`));
      actions.appendChild(link);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${CARD}__action-btn ${CARD}__atc`;
      button.setAttribute('aria-label', addToCartLabel);
      button.disabled = product.inStock === false;
      button.appendChild(createCartIcon(`${CARD}__action-btn-icon`));
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onAddToCartClick(product, button);
      });
      actions.appendChild(button);
    }
  }

  if (typeof onWishlistClick === 'function') {
    const wishlistLabel = labels.addToWishlistLabel || 'Add to wish list';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${CARD}__action-btn ${CARD}__wishlist`;
    button.setAttribute('aria-label', `${wishlistLabel} ${productName}`);
    button.setAttribute('aria-pressed', 'false');
    button.dataset.sku = product.sku;
    button.appendChild(createWishlistIcon(`${CARD}__action-btn-icon`));
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onWishlistClick(product, button);
    });
    actions.appendChild(button);
  }

  return actions.childElementCount ? actions : null;
}

/**
 * @param {object} options
 * @param {(product: object) => string} options.routeProduct
 * @param {object} [options.labels]
 * @param {(ctx: object) => void} [options.renderProductImage]
 * @param {(product: object) => boolean} [options.requiresPdpConfiguration]
 * @param {(product: object, button: HTMLElement) => void} [options.onAddToCartClick]
 * @param {(product: object, button: HTMLElement) => void} [options.onWishlistClick]
 * @param {boolean} [options.showActions=true]
 */
export function createProductCardSlots({
  routeProduct,
  labels = {},
  renderProductImage,
  requiresPdpConfiguration,
  onAddToCartClick,
  onWishlistClick,
  showActions = true,
}) {
  return {
    ProductImage: (ctx) => {
      const { product } = ctx;
      const productHref = routeProduct(product);
      const mediaWrap = document.createElement('div');
      mediaWrap.className = `${CARD}__media-wrap`;

      const mediaLink = document.createElement('a');
      mediaLink.className = `${CARD}__media-link`;
      mediaLink.href = productHref;
      mediaLink.setAttribute('aria-label', product.name || product.sku);

      const media = document.createElement('div');
      media.className = `${CARD}__media`;
      mediaLink.appendChild(media);
      mediaWrap.appendChild(mediaLink);

      if (renderProductImage) {
        renderProductImage({
          ...ctx,
          wrapper: media,
          replaceWith: (element) => {
            media.appendChild(element);
            element.querySelector('img')?.classList.add(`${CARD}__image`);
          },
        });
      }

      if (showActions) {
        const cardActions = buildActions({
          product,
          routeProduct,
          labels,
          requiresPdpConfiguration,
          onAddToCartClick,
          onWishlistClick,
        });
        if (cardActions) mediaWrap.appendChild(cardActions);
      }

      ctx.replaceWith(mediaWrap);
    },

    ProductName: (ctx) => {
      const { product } = ctx;
      const data = parseProductCardData(product);
      const productHref = routeProduct(product);
      const wrap = document.createElement('div');
      wrap.className = `${CARD}__title-block`;

      const title = document.createElement('h3');
      title.className = `${CARD}__title`;
      const titleLink = document.createElement('a');
      titleLink.className = `${CARD}__title-link`;
      titleLink.href = productHref;
      titleLink.textContent = product.name || product.sku;
      title.appendChild(titleLink);
      wrap.appendChild(title);

      if (data.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = `${CARD}__subtitle`;
        subtitle.textContent = data.subtitle;
        wrap.appendChild(subtitle);
      }

      const reviews = buildReviews(data, labels, productHref);
      if (reviews) wrap.appendChild(reviews);

      ctx.replaceWith(wrap);
    },

    ProductPrice: (ctx) => {
      const data = parseProductCardData(ctx.product);
      const pricing = buildPricing(data, labels);
      if (pricing) ctx.replaceWith(pricing);
    },

    ProductActions: (ctx) => {
      ctx.replaceWith(document.createDocumentFragment());
    },
  };
}

/** @param {HTMLElement|null} button @param {boolean} loading */
export function setProductCardActionLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.toggleAttribute('aria-busy', loading);
  if (loading) {
    button.setAttribute('disabled', '');
  } else {
    button.removeAttribute('disabled');
  }
}
