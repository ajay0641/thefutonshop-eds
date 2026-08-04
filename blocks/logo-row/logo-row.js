/*
 * Logo Row Block
 * A centered, wrapping row of press / media logos (e.g. a "Featured In" section).
 * The heading (e.g. "Featured In") is authored as default content (an h2) ABOVE
 * this block, not inside it.
 *
 * Authoring: one image per cell. Cells may be grouped into rows or listed one per
 * row - all images are flattened into a single wrapping row.
 *   | Logo Row |
 *   | :------- |
 *   | <picture> |
 *   | <picture> |
 *   | ...       |
 */

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'logo-row-list';

  // Collect every image (picture) across all rows/cells into one flat list.
  block.querySelectorAll('picture, img').forEach((node) => {
    // Skip <img> that already lives inside a <picture> we will process.
    if (node.tagName === 'IMG' && node.closest('picture')) return;

    const li = document.createElement('li');
    li.className = 'logo-row-item';
    li.append(node);
    ul.append(li);
  });

  block.textContent = '';
  block.append(ul);
}
