import NewsletterContainer from '@ajay0641/tfs-newsletter/containers/NewsletterContainer.js';
import { render as provider } from '@ajay0641/tfs-newsletter/render.js';

// Initialize drop-in when this block loads
import '../../scripts/initializers/newsletter.js';

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  block.replaceChildren();

  await provider.render(NewsletterContainer, {})(block);
}
