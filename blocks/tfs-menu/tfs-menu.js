import MenuContainer from '@ajay0641/tfs-menu/containers/MenuContainer.js';
import { render as provider } from '@ajay0641/tfs-menu/render.js';
import { readBlockConfig } from '../../scripts/aem.js';

import '../../scripts/initializers/menu.js';

/**
 * @param {Record<string, string>} config
 * @returns {string}
 */
function getParentId(config) {
  return (
    config['parent-id']
    || config.parentid
    || config.parentId
    || '2'
  ).trim();
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const parentId = getParentId(config);

  block.replaceChildren();

  await provider.render(MenuContainer, {
    parentId,
  })(block);
}
