/*
 * Promo Banner Block
 * A full-width promotional banner. The whole banner is a single link that
 * wraps one or more images (e.g. a product photo alongside a promo graphic).
 * Authored as: div.promo-banner > row > cell with picture(s) + a link.
 */

/**
 * loads and decorates the promo banner
 * @param {Element} block The promo-banner block element
 */
export default function decorate(block) {
  const pictures = [...block.querySelectorAll('picture')];
  if (!pictures.length) return;

  // Find the destination link authored in the block.
  const anchor = block.querySelector('a[href]');
  let href = anchor?.getAttribute('href');
  if (!href) {
    // Fall back to a bare URL authored as text.
    const text = block.textContent.trim();
    if (/^https?:\/\//.test(text)) href = text;
  }

  // Build a clean link that wraps every image in the banner.
  const firstAlt = pictures[0].querySelector('img')?.getAttribute('alt') || '';
  const label = anchor?.textContent.trim() || firstAlt || 'Promotion';

  const wrapper = document.createElement(href ? 'a' : 'div');
  wrapper.className = 'promo-banner-link';
  if (href) {
    wrapper.href = href;
    wrapper.setAttribute('aria-label', label);
  }
  pictures.forEach((picture) => wrapper.append(picture));

  block.textContent = '';
  block.append(wrapper);
  block.classList.toggle('promo-banner-multi', pictures.length > 1);
}
