import { rootLink } from './commerce.js';

export const PRODUCT_IMAGE_PLACEHOLDER_PATH = '/images/placeholder.jpg';

/** Default cart / mini-cart thumbnail size (matches cart drop-in defaults). */
export const CART_IMAGE_DIMENSIONS = {
  width: 300,
  height: 300,
};

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
 * Makes image URLs absolute so `tryRenderAemAssetsImage` can safely call `new URL()`.
 * @param {string} [url]
 * @returns {string}
 */
export function resolveProductImageSrc(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return getProductImagePlaceholderUrl();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `${window.location.protocol}${trimmed}`;
  try {
    return new URL(trimmed, window.location.origin).href;
  } catch {
    return getProductImagePlaceholderUrl();
  }
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

  const cartImageSrc = product?.image?.src?.trim() || product?.image?.url?.trim();
  if (cartImageSrc) {
    return {
      url: cartImageSrc,
      label: product?.image?.alt || product?.name || product?.sku || '',
    };
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
    src: resolveProductImageSrc(props?.src?.trim() || primary.url),
    alt: props?.alt || primary.label,
  };
}

/**
 * Builds Thumbnail slot image config for cart / mini-cart / checkout.
 * Ensures width+height are present in both imageProps and params (avoids height=NaN
 * in srcset when commerce-assets-enabled remaps image params).
 * @param {object} [defaultImageProps]
 * @param {object} [item] Cart line item
 * @param {{ width?: number, height?: number }} [dimensions]
 * @returns {{ alias: string, imageProps: object, params: { width: number, height: number } }}
 */
export function getCartItemImageSlotConfig(
  defaultImageProps,
  item,
  dimensions = CART_IMAGE_DIMENSIONS,
) {
  const width = Number(defaultImageProps?.width) || dimensions.width;
  const height = Number(defaultImageProps?.height) || dimensions.height;
  const imageProps = withProductImageFallback(defaultImageProps, item);

  return {
    alias: item?.sku || item?.topLevelSku || 'cart-item',
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
