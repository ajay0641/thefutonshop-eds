import { search } from '@dropins/storefront-product-discovery/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { getSearchStateFromUrl } from './search-url.js';

const PRICE_ATTRIBUTE = 'price';
const DEBOUNCE_MS = 300;

/**
 * @param {object[]} buckets
 * @returns {{ min: number, max: number }}
 */
export function getPriceBoundsFromBuckets(buckets) {
  let min = Infinity;
  let max = -Infinity;

  buckets.forEach((bucket) => {
    if (bucket.from != null) min = Math.min(min, bucket.from);
    if (bucket.to != null) max = Math.max(max, bucket.to);
    if (bucket.from != null && bucket.to == null) max = Math.max(max, bucket.from);
  });

  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max) || max < min) max = min;

  return { min, max };
}

/**
 * @param {object} facet
 * @param {{ min: number, max: number }} bounds
 * @returns {{ from: number, to: number }}
 */
function getInitialPriceRange(facet, bounds) {
  const selectedBucket = facet.buckets?.find((bucket) => bucket.selected);
  if (selectedBucket) {
    return {
      from: selectedBucket.from ?? bounds.min,
      to: selectedBucket.to ?? bounds.max,
    };
  }

  const lastRequest = events.lastPayload('search/result')?.request;
  const priceFilter = lastRequest?.filter?.find((filter) => filter.attribute === PRICE_ATTRIBUTE);
  if (priceFilter?.range) {
    return {
      from: priceFilter.range.from ?? bounds.min,
      to: priceFilter.range.to ?? bounds.max,
    };
  }

  return { from: bounds.min, to: bounds.max };
}

/**
 * @param {object[]} items
 * @returns {string}
 */
function getCurrencyFromItems(items) {
  const item = items?.[0];
  const direct = item?.price?.regular?.amount?.currency;
  if (direct) return direct;

  const rangeCurrency = item?.priceRange?.minimum?.regular?.amount?.currency;
  if (rangeCurrency) return rangeCurrency;

  return 'USD';
}

/**
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatPrice(amount, currency) {
  const locale = document.documentElement.lang || 'en-US';
  const code = Intl.supportedValuesOf('currency').includes(currency) ? currency : 'USD';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * @param {number} from
 * @param {number} to
 * @param {{ min: number, max: number }} bounds
 */
function applyPriceFilter(from, to, bounds) {
  const lastPayload = events.lastPayload('search/result');
  const request = lastPayload?.request;
  if (!request) return;

  const filters = (request.filter || []).filter((filter) => filter.attribute !== PRICE_ATTRIBUTE);
  const isFullRange = from <= bounds.min && to >= bounds.max;

  if (!isFullRange) {
    filters.push({
      attribute: PRICE_ATTRIBUTE,
      range: { from, to },
    });
  }

  search({
    ...request,
    filter: filters,
    currentPage: 1,
  }).catch((error) => {
    console.error('Error applying price range filter', error);
  });
}

/**
 * @param {object} facet
 * @returns {boolean}
 */
export function isPriceRangeFacet(facet) {
  if (!facet?.buckets?.length) return false;
  if (facet.attribute === PRICE_ATTRIBUTE) return true;
  return facet.buckets[0]?.__typename === 'RangeBucket';
}

/**
 * @param {object} facet
 * @returns {HTMLElement}
 */
export function createPriceRangeFacet(facet) {
  const bounds = getPriceBoundsFromBuckets(facet.buckets);
  const initialRange = getInitialPriceRange(facet, bounds);
  const currency = getCurrencyFromItems(events.lastPayload('search/result')?.result?.items);

  const facetEl = document.createElement('div');
  facetEl.className = 'product-discovery-facet search__price-range-facet';

  const header = document.createElement('div');
  header.className = 'product-discovery-facet__header';
  header.textContent = facet.title || 'Price';

  const bucket = document.createElement('div');
  bucket.className = 'product-discovery-facet__bucket search__price-range';

  const values = document.createElement('div');
  values.className = 'search__price-range__values';

  const minLabel = document.createElement('span');
  minLabel.className = 'search__price-range__value search__price-range__value--min';

  const maxLabel = document.createElement('span');
  maxLabel.className = 'search__price-range__value search__price-range__value--max';

  values.append(minLabel, maxLabel);

  const track = document.createElement('div');
  track.className = 'search__price-range__track';

  const rail = document.createElement('div');
  rail.className = 'search__price-range__rail';
  rail.setAttribute('aria-hidden', 'true');

  const fill = document.createElement('div');
  fill.className = 'search__price-range__fill';
  fill.setAttribute('aria-hidden', 'true');

  track.append(rail, fill);

  const minInput = document.createElement('input');
  minInput.type = 'range';
  minInput.className = 'search__price-range__input search__price-range__input--min';
  minInput.min = String(bounds.min);
  minInput.max = String(bounds.max);
  minInput.step = '1';
  minInput.value = String(initialRange.from);
  minInput.setAttribute('aria-label', `${facet.title || 'Price'} minimum`);

  const maxInput = document.createElement('input');
  maxInput.type = 'range';
  maxInput.className = 'search__price-range__input search__price-range__input--max';
  maxInput.min = String(bounds.min);
  maxInput.max = String(bounds.max);
  maxInput.step = '1';
  maxInput.value = String(initialRange.to);
  maxInput.setAttribute('aria-label', `${facet.title || 'Price'} maximum`);

  track.append(minInput, maxInput);
  bucket.append(values, track);
  facetEl.append(header, bucket);

  let debounceTimer;
  let syncingFromSearch = false;
  let currentFrom = initialRange.from;
  let currentTo = initialRange.to;

  const updateFill = () => {
    const span = bounds.max - bounds.min || 1;
    const start = ((currentFrom - bounds.min) / span) * 100;
    const end = ((currentTo - bounds.min) / span) * 100;
    fill.style.left = `${start}%`;
    fill.style.width = `${Math.max(end - start, 0)}%`;
  };

  const updateLabels = () => {
    minLabel.textContent = formatPrice(currentFrom, currency);
    maxLabel.textContent = formatPrice(currentTo, currency);
  };

  const scheduleSearch = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      applyPriceFilter(currentFrom, currentTo, bounds);
    }, DEBOUNCE_MS);
  };

  const applyRange = (from, to, { triggerSearch = false } = {}) => {
    currentFrom = from;
    currentTo = to;
    minInput.value = String(from);
    maxInput.value = String(to);
    updateFill();
    updateLabels();
    if (triggerSearch) scheduleSearch();
  };

  const syncFromUrl = () => {
    const urlState = getSearchStateFromUrl(new URL(window.location.href));
    const priceFilter = urlState.filter.find((filter) => filter.attribute === PRICE_ATTRIBUTE);

    syncingFromSearch = true;
    if (priceFilter?.range) {
      applyRange(
        priceFilter.range.from ?? bounds.min,
        priceFilter.range.to ?? bounds.max,
      );
    } else {
      applyRange(bounds.min, bounds.max);
    }
    syncingFromSearch = false;
  };

  events.on('search/result', syncFromUrl);

  const syncFromInputs = (source) => {
    if (syncingFromSearch) return;

    let nextFrom = Number(minInput.value);
    let nextTo = Number(maxInput.value);

    if (nextFrom > nextTo) {
      if (source === minInput) {
        nextTo = nextFrom;
        maxInput.value = String(nextTo);
      } else {
        nextFrom = nextTo;
        minInput.value = String(nextFrom);
      }
    }

    applyRange(nextFrom, nextTo, { triggerSearch: true });
  };

  minInput.addEventListener('input', () => syncFromInputs(minInput));
  maxInput.addEventListener('input', () => syncFromInputs(maxInput));

  minInput.addEventListener('change', () => syncFromInputs(minInput));
  maxInput.addEventListener('change', () => syncFromInputs(maxInput));

  updateFill();
  updateLabels();

  return facetEl;
}

/**
 * @param {object} ctx Facets Facet slot context
 */
export function renderPriceRangeFacetSlot(ctx) {
  const { data } = ctx;
  if (!isPriceRangeFacet(data)) return;

  ctx.replaceWith(createPriceRangeFacet(data));
}
