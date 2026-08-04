/*
 * Feature Grid Block
 * A responsive grid of promotional image tiles. Each tile is a background image
 * with an overlay caption (heading) and a "Shop Now" call to action. The whole
 * tile is a single clickable link. The first tile renders as a larger/featured
 * tile; the remaining tiles form a grid.
 *
 * Authoring: one row per tile, three cells.
 *   | Feature Grid |
 *   | :----------- |
 *   | <picture> | Up To 45% off | [Shop Now](/link) |
 *   | <picture> | WAKE UP FEELING REFRESHED | [Shop Now](/link) |
 *
 * The heading cell holds the overlay text; the link cell holds the CTA.
 * Copy, images, and links are read from the DOM and never hardcoded.
 */

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'feature-grid-list';

  [...block.children].forEach((row, index) => {
    const cells = [...row.children];
    const picture = row.querySelector('picture');
    const link = row.querySelector('a');
    const href = link?.getAttribute('href');
    const cta = link?.textContent.trim() || 'Shop Now';

    // Heading = text from the cell that holds neither the picture nor the link.
    let heading = '';
    cells.forEach((cell) => {
      if (cell.querySelector('picture, img') || cell.querySelector('a')) return;
      const text = cell.textContent.trim();
      if (text && !heading) heading = text;
    });

    const li = document.createElement('li');
    li.className = 'feature-grid-tile';
    if (index === 0) li.classList.add('feature-grid-tile-featured');

    const tileLink = document.createElement('a');
    tileLink.className = 'feature-grid-link';
    if (href) tileLink.href = href;
    tileLink.setAttribute('aria-label', heading || cta);

    if (picture) {
      const imgWrap = document.createElement('span');
      imgWrap.className = 'feature-grid-image';
      imgWrap.append(picture);
      tileLink.append(imgWrap);
    }

    const caption = document.createElement('span');
    caption.className = 'feature-grid-caption';

    if (heading) {
      const headingEl = document.createElement('span');
      headingEl.className = 'feature-grid-heading';
      headingEl.textContent = heading;
      caption.append(headingEl);
    }

    const ctaEl = document.createElement('span');
    ctaEl.className = 'feature-grid-cta';
    ctaEl.textContent = cta;
    caption.append(ctaEl);

    tileLink.append(caption);
    li.append(tileLink);
    ul.append(li);
    row.remove();
  });

  block.replaceChildren(ul);
}
