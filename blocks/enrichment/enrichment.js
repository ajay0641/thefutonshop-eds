import { readBlockConfig } from '../../scripts/aem.js';
import { getProductSku, IS_UE } from '../../scripts/commerce.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * Fetches the enrichment index, tolerating a missing index file.
 * The core fetchIndex() calls resp.json() without checking resp.ok, so a 404
 * (no enrichment content published) throws "Unexpected end of JSON input".
 * Enrichment is optional, so return an empty index instead of throwing.
 * @param {string} indexFile Index path without extension
 * @returns {Promise<{data: Array}>}
 */
async function fetchEnrichmentIndex(indexFile) {
  try {
    const resp = await fetch(`/${indexFile}.json?limit=500&offset=0`);
    if (!resp.ok) return { data: [] };
    const json = await resp.json();
    return { data: Array.isArray(json.data) ? json.data : [] };
  } catch (error) {
    return { data: [] };
  }
}

export default async function decorate(block) {
  const { type, position } = readBlockConfig(block);

  try {
    const filters = {};
    if (!type) {
      throw new Error('No type found in enrichment block configuration');
    }

    if (type === 'product') {
      const productSku = getProductSku();
      if (!productSku) {
        throw new Error('No product SKU found in URL');
      }
      filters.products = productSku;
    }

    if (type === 'category') {
      // Look for PLP block using "product-list-page" block selector
      const plpBlock = document.querySelector('.product-list-page');
      if (!plpBlock) {
        throw new Error('No product list page block found');
      }

      const category = plpBlock.dataset?.urlpath || readBlockConfig(plpBlock).urlpath;
      if (!category) {
        throw new Error('No category ID found in product list page block');
      }
      filters.categories = category;
    }

    if (position) {
      filters.positions = position;
    }

    const index = await fetchEnrichmentIndex('enrichment/enrichment');
    if (!index.data.length) return;
    const matchingFragments = index.data
      .filter((fragment) => Object.keys(filters).every((filterKey) => {
        const values = JSON.parse(fragment[filterKey]);
        return values.includes(filters[filterKey]);
      }))
      .map((fragment) => fragment.path);

    (await Promise.all(matchingFragments.map((path) => loadFragment(path))))
      .filter((fragment) => fragment)
      .forEach((fragment) => {
        const sections = fragment.querySelectorAll(':scope .section');

        // If only single section, replace block with content of section
        if (sections.length === 1) {
          block.closest('.section').classList.add(...sections[0].classList);
          const wrapper = block.closest('.enrichment-wrapper');
          Array.from(sections[0].children)
            .forEach((child) => wrapper.parentNode.insertBefore(child, wrapper));
        } else if (sections.length > 1) {
          // If multiple sections, insert them after section of block
          const blockSection = block.closest('.section');
          Array.from(sections)
            .reverse()
            .forEach((section) => blockSection
              .parentNode.insertBefore(section, blockSection.nextSibling));
        }
      });
  } catch (error) {
    console.error(error);
  } finally {
    // don't remove wrapper in UE because then it will not be authorable
    if (!IS_UE) block.closest('.enrichment-wrapper')?.remove();
  }
}
