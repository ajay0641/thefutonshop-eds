import ProductSliderContainer from '@ajay0641/tfs-product-slider/containers/ProductSliderContainer.js';
import { render as provider } from '@ajay0641/tfs-product-slider/render.js';
import { getProductSlider } from '@ajay0641/tfs-product-slider/api.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { getProductLink } from '../../scripts/commerce.js';

// Initialize drop-ins when this block loads
import '../../scripts/initializers/product-slider.js';
import '../../scripts/initializers/cart.js';

/**
 * Builds Catalog Service filter clauses from optional authored values.
 * Default matches drop-in: isNew = 1
 * @param {Record<string, string>} config
 * @returns {{ attribute: string, eq: string }[]|undefined}
 */
function buildFilters(config) {
  const attribute = (
    config.attribute
    || config['filter-attribute']
    || config.filterattribute
    || 'isNew'
  ).trim();
  const eq = (
    config.eq
    || config['filter-eq']
    || config.filtereq
    || '1'
  ).trim();
  if (!attribute) return undefined;
  return [{ attribute, eq }];
}

/**
 * Whether the product needs PDP option selection before cart.
 * @param {{ isPriceRange?: boolean, addToCartAllowed?: boolean, inStock?: boolean }} product
 * @returns {boolean}
 */
function requiresPdpConfiguration(product) {
  return product.isPriceRange === true || product.addToCartAllowed === false;
}

/**
 * Toggle loading UI on the ATC icon button.
 * @param {HTMLElement|null} button
 * @param {boolean} loading
 */
function setAtcLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.toggleAttribute('aria-busy', loading);
  if (loading) {
    button.setAttribute('disabled', '');
  } else {
    button.removeAttribute('disabled');
  }
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const title = config.title || config.heading || '';
  const phrase = config.phrase || '';
  const pageSize = Number.parseInt(config['page-size'] || config.pagesize || '8', 10) || 8;
  const currentPage = Number.parseInt(config['current-page'] || config.currentpage || '1', 10) || 1;
  const filter = buildFilters(config);

  block.replaceChildren();

  /** @type {HTMLElement|null} */
  let lastAtcButton = null;

  // Capture which ATC button was clicked (drop-in callback only receives product)
  block.addEventListener('click', (event) => {
    const button = event.target.closest?.('.tfsproductslider-product-card__atc');
    if (button instanceof HTMLElement) {
      lastAtcButton = button;
    }
  }, true);

  await provider.render(ProductSliderContainer, {
    title: title || undefined,
    phrase,
    pageSize,
    currentPage,
    filter,
    // Ensure PDP links match storefront routes (/products/{urlKey}/{sku})
    fetchProducts: async () => {
      const result = await getProductSlider({
        phrase,
        pageSize,
        currentPage,
        filter,
      });
      return {
        ...result,
        items: (result.items || []).map((item) => ({
          ...item,
          url: getProductLink(item.urlKey, item.sku),
        })),
      };
    },
    onAddToCart: async (product) => {
      if (!product?.sku) return;

      const button = lastAtcButton;

      // Complex / needs options → PDP (same pattern as PLP)
      if (requiresPdpConfiguration(product)) {
        window.location.href = getProductLink(product.urlKey, product.sku);
        return;
      }

      if (product.inStock === false) return;

      setAtcLoading(button, true);
      try {
        await cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]);
      } catch (error) {
        console.error('TFS Product Slider: add to cart failed', error);
      } finally {
        setAtcLoading(button, false);
        lastAtcButton = null;
      }
    },
  })(block);
}
