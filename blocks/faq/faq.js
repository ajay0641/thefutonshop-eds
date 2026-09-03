import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import { readBlockConfig } from '../../scripts/aem.js';

const FAQ_QUERY = `{
  faqs {
    id
    question
    answer
  }
}`;

/**
 * Resolves the GraphQL endpoint from block config or site config.
 * @param {Record<string, string>} config
 * @returns {string}
 */
function resolveEndpoint(config) {
  if (config.endpoint) return config.endpoint;
  const fromConfig = getConfigValue('faq-endpoint');
  if (!fromConfig) {
    throw new Error('Missing faq-endpoint in config.json');
  }
  return fromConfig;
}

/**
 * Fetches FAQ items from the App Builder GraphQL endpoint.
 * @param {string} endpoint
 * @returns {Promise<Array<{id: string, question: string, answer: string}>>}
 */
async function fetchFaqs(endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: FAQ_QUERY }),
  });

  if (!response.ok) {
    throw new Error(`FAQ request failed with status ${response.status}`);
  }

  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((err) => err.message).join('; '));
  }

  return json.data?.faqs || [];
}

/**
 * Builds a single FAQ accordion item.
 * @param {{id: string, question: string, answer: string}} faq
 * @returns {HTMLDetailsElement}
 */
function createFaqItem(faq) {
  const details = document.createElement('details');
  details.className = 'faq-item';
  if (faq.id) details.dataset.faqId = faq.id;

  const summary = document.createElement('summary');
  summary.className = 'faq-item-question';
  summary.textContent = faq.question || '';

  const body = document.createElement('div');
  body.className = 'faq-item-answer';
  // Answers from App Builder are authored HTML
  body.innerHTML = faq.answer || '';

  details.append(summary, body);
  return details;
}

/**
 * loads and decorates the FAQ block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const heading = config.heading || '';

  block.textContent = '';
  block.classList.add('loading');

  if (heading) {
    const title = document.createElement('h2');
    title.className = 'faq-heading';
    title.textContent = heading;
    block.append(title);
  }

  const list = document.createElement('div');
  list.className = 'faq-list';
  list.setAttribute('role', 'list');
  block.append(list);

  try {
    const endpoint = resolveEndpoint(config);
    const faqs = await fetchFaqs(endpoint);

    if (!faqs.length) {
      const empty = document.createElement('p');
      empty.className = 'faq-empty';
      empty.textContent = 'No FAQs available.';
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    faqs.forEach((faq) => {
      if (!faq?.question) return;
      const item = createFaqItem(faq);
      item.setAttribute('role', 'listitem');
      fragment.append(item);
    });
    list.append(fragment);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load FAQs:', error);
    const message = document.createElement('p');
    message.className = 'faq-error';
    message.textContent = error?.name === 'TypeError'
      ? 'Unable to load FAQs (network/CORS). Ensure the API Mesh allows this origin.'
      : 'Unable to load FAQs. Please try again later.';
    list.append(message);
  } finally {
    block.classList.remove('loading');
    block.classList.add('loaded');
  }
}
