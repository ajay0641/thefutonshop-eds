/*
 * Text Band Block
 * A simple centered heading/subheading band (no media), used for section
 * intros like the homepage "Healthy Home | Non-Toxic | Handcrafted In
 * California" strip. Each authored row's contents are lifted directly into
 * the block so the headings sit at the top level and center via CSS.
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    const cell = row.children.length === 1 ? row.firstElementChild : row;
    block.append(...cell.childNodes);
    row.remove();
  });
}
