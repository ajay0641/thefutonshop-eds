import { rootLink } from './commerce.js';

export const PRODUCT_IMAGE_PLACEHOLDER_PATH = '/images/placeholder.jpg';

/**
 * Local product image placeholder (ACCS admin placeholders are not exposed in Catalog Service).
 * Returns an absolute URL so AEM Assets helpers can parse it safely.
 * @returns {string}
 */
export function getProductImagePlaceholderUrl() {
  const path = rootLink(PRODUCT_IMAGE_PLACEHOLDER_PATH);
  if (/^https?:\/\//.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalizedPath}`;
}

/**
 * @param {string} [url]
 * @returns {boolean}
 */
export function isProductImagePlaceholder(url) {
  if (!url) return false;
  return url.includes(PRODUCT_IMAGE_PLACEHOLDER_PATH);
}

/**
 * @param {object} [product]
 * @returns {{ url: string, label: string }}
 */
export function getPrimaryProductImage(product) {
  const images = product?.images;
  if (Array.isArray(images)) {
    const withUrl = images.find((img) => img?.url?.trim());
    if (withUrl?.url) {
      return {
        url: withUrl.url,
        label: withUrl.label || product?.name || product?.sku || '',
      };
    }
  }

  return {
    url: getProductImagePlaceholderUrl(),
    label: product?.name || product?.sku || 'Product image placeholder',
  };
}

/**
 * @param {object} [product]
 * @returns {string}
 */
export function getPrimaryProductImageUrl(product) {
  return getPrimaryProductImage(product).url;
}

/**
 * @param {object} [imageProps]
 * @param {object} [product]
 * @returns {object}
 */
export function withProductImageFallback(imageProps, product) {
  const props = imageProps || {};
  const primary = getPrimaryProductImage(product);
  return {
    ...props,
    src: props?.src?.trim() || primary.url,
    alt: props?.alt || primary.label,
  };
}

/**
 * Ensures PDP/PLP product payloads always include at least one image URL.
 * @param {object} [product]
 * @returns {object|undefined}
 */
export function ensureProductImages(product) {
  if (!product) return product;

  const placeholderUrl = getProductImagePlaceholderUrl();
  const label = product.name || product.sku || 'Product image placeholder';
  const images = product.images || [];
  const validImages = images.filter((img) => img?.url?.trim());

  if (validImages.length === 0) {
    product.images = [{
      url: placeholderUrl,
      label,
      roles: ['image', 'thumbnail'],
    }];
    return product;
  }

  product.images = images.map((img) => {
    if (img?.url?.trim()) return img;
    return {
      ...img,
      url: placeholderUrl,
      label: img?.label || label,
    };
  });

  return product;
}
