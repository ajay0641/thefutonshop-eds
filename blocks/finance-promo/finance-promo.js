/*
 * Finance Promo Block
 * A financing band (Synchrony) with a logo, headings, a supporting paragraph,
 * and a "SEE IF YOU QUALIFY" call-to-action rendered as a button.
 *
 * Authoring: one div.finance-promo whose rows hold the content in order:
 *   | Finance Promo |
 *   | :------------ |
 *   | <picture> (logo)                                   |
 *   | EXCLUSIVE ONLINE & IN-STORE OFFER (heading)        |
 *   | 12 MONTHS \| NO INTEREST (heading)                 |
 *   | AFFORDABLE MONTHLY PAYMENT (paragraph)             |
 *   | [SEE IF YOU QUALIFY](https://etail.mysynchrony...) |
 *
 * Copy, image and link are read from the authored DOM; nothing is hardcoded.
 */

export default function decorate(block) {
  const picture = block.querySelector('picture');
  const headings = [...block.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const paragraphs = [...block.querySelectorAll('p')].filter((p) => !p.querySelector('a') && p.textContent.trim());
  const link = block.querySelector('a');

  const media = document.createElement('div');
  media.className = 'finance-promo-media';
  if (picture) media.append(picture);

  const content = document.createElement('div');
  content.className = 'finance-promo-content';
  headings.forEach((h, i) => {
    h.classList.add('finance-promo-heading');
    h.classList.add(i === 0 ? 'finance-promo-eyebrow' : 'finance-promo-title');
    content.append(h);
  });
  paragraphs.forEach((p) => {
    p.classList.add('finance-promo-text');
    content.append(p);
  });

  const actions = document.createElement('div');
  actions.className = 'finance-promo-actions';
  if (link) {
    link.classList.add('finance-promo-cta');
    if (/^https?:/i.test(link.getAttribute('href') || '') && !link.target) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
    actions.append(link);
  }

  block.replaceChildren(media, content, actions);
}
