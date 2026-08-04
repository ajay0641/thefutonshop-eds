/*
 * Image Band Block
 * A full-width row of images (2+), optionally linked. Used for promotional
 * image bands like the "50th Anniversary" split panel.
 * Authoring: one row per image.
 *   | Image Band |
 *   | :--------- |
 *   | <picture>            |  (optional link in the cell)
 *   | <picture>  /link     |
 * Images stack vertically on mobile and sit side-by-side on desktop.
 */

export default function decorate(block) {
  const items = [...block.children];
  block.style.setProperty('--image-band-count', items.length);

  items.forEach((row) => {
    row.classList.add('image-band-item');

    const picture = row.querySelector('picture');
    const link = row.querySelector('a');
    const href = link?.getAttribute('href');

    // If the cell has both a picture and a link, wrap the picture in the link.
    if (picture && href && link && !link.contains(picture)) {
      link.textContent = '';
      link.append(picture);
      row.replaceChildren(link);
    } else if (picture) {
      row.replaceChildren(picture);
    }

    // Size each item's width proportional to its image aspect ratio so the
    // images sit side-by-side at a shared height (matches source layouts where
    // panels aren't necessarily equal width). Equal-ratio images give 50/50.
    const img = row.querySelector('img');
    if (img) {
      const setRatio = () => {
        if (img.naturalWidth && img.naturalHeight) {
          row.style.flexGrow = (img.naturalWidth / img.naturalHeight).toFixed(4);
        }
      };
      if (img.complete) setRatio();
      else img.addEventListener('load', setRatio, { once: true });
    }
  });
}
