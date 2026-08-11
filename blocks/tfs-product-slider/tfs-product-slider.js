import ProductSliderContainer from '@ajay0641/tfs-product-slider/containers/ProductSliderContainer.js';
import { render as provider } from '@ajay0641/tfs-product-slider/render.js';
import { getProductSlider } from '@ajay0641/tfs-product-slider/api.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { getProductLink } from '../../scripts/commerce.js';

// Initialize drop-in when this block loads
import '../../scripts/initializers/product-slider.js';

/**
 * Builds Catalog Service filter clauses from optional authored values.
 * Default matches drop-in: isNew = 1
 * @param {Record<string, string>} config
 * @returns {{ attribute: string, eq: string }[]|undefined}
 */
function buildFilters(config) {
  const attribute = (config['filter-attribute'] || config.filterattribute || 'isNew').trim();
  const eq = (config['filter-eq'] || config.filtereq || '1').trim();
  if (!attribute) return undefined;
  return [{ attribute, eq }];
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
  })(block);
}
