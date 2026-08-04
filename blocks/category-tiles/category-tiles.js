/*
 * Category Tiles Block
 * A row of portrait category tiles: each tile is an image with a labelled link
 * below (e.g. "MATTRESSES >"). The whole tile is clickable.
 * Authoring: one row per tile.
 *   | Category Tiles |
 *   | :------------- |
 *   | <picture>  [MATTRESSES >](/link) |
 *   | <picture>  [PILLOWS >](/link)    |
 */

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'category-tiles-list';

  [...block.children].forEach((row) => {
    const picture = row.querySelector('picture');
    const link = row.querySelector('a');
    const href = link?.getAttribute('href');
    const label = link?.textContent.trim() || '';

    const li = document.createElement('li');
    li.className = 'category-tile';

    const tileLink = document.createElement('a');
    tileLink.className = 'category-tile-link';
    if (href) tileLink.href = href;
    tileLink.setAttribute('aria-label', label.replace(/\s*>\s*$/, '') || 'Category');

    if (picture) {
      const imgWrap = document.createElement('span');
      imgWrap.className = 'category-tile-image';
      imgWrap.append(picture);
      tileLink.append(imgWrap);
    }

    if (label) {
      const labelEl = document.createElement('span');
      labelEl.className = 'category-tile-label';
      labelEl.textContent = label;
      tileLink.append(labelEl);
    }

    li.append(tileLink);
    ul.append(li);
    row.remove();
  });

  block.replaceChildren(ul);
}
