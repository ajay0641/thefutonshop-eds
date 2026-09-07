/**
 * Decorates the banner-description block.
 * When a category image is available on the page, banner-description-wrapper is moved
 * inside .search__category-image to render a side-by-side banner layout.
 * If no category image is available, banner-description is hidden.
 * @param {Element} block
 */
export default async function decorate(block) {
  const elements = [...block.querySelectorAll('p, h1, h2, h3, h4, h5, h6, strong, div')]
    .map((el) => {
      if (el.tagName === 'DIV' && el.children.length > 0) return null;
      const text = el.textContent.trim();
      return text ? { text, tag: el.tagName } : null;
    })
    .filter(Boolean);

  const uniqueItems = [];
  elements.forEach((item) => {
    if (!uniqueItems.some((u) => u.text === item.text)) {
      uniqueItems.push(item);
    }
  });

  if (!uniqueItems.length) {
    const wrapper = block.closest('.banner-description-wrapper') || block;
    wrapper.style.display = 'none';
    return;
  }

  block.innerHTML = '';
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'banner-description__content';

  uniqueItems.forEach((item, index) => {
    const textLower = item.text.toLowerCase();

    if (index === 0) {
      // Top Tag (e.g. LABOR DAY SALE)
      const tag = document.createElement('div');
      tag.className = 'banner-description__tag';
      tag.textContent = item.text;
      contentWrapper.appendChild(tag);
    } else if (
      textLower.includes('up to')
      || textLower.includes('off')
      || textLower.includes('%')
      || (index === 1 && !textLower.includes('sale') && !textLower.includes('ends'))
    ) {
      // Badge (e.g. Up To 50% Off)
      const badge = document.createElement('div');
      badge.className = 'banner-description__badge';
      badge.textContent = item.text;
      contentWrapper.appendChild(badge);
    } else if (
      item.tag.startsWith('H')
      || textLower.includes('sale')
      || textLower.includes('ends')
      || textLower.includes('save')
      || index === 2
    ) {
      // Title (e.g. Sale Ends Sept 7th)
      const title = document.createElement('h2');
      title.className = 'banner-description__title';
      title.textContent = item.text;
      contentWrapper.appendChild(title);
    } else {
      // Subtext / Description
      const subtext = document.createElement('p');
      subtext.className = 'banner-description__text';
      subtext.textContent = item.text;
      contentWrapper.appendChild(subtext);
    }
  });

  block.appendChild(contentWrapper);

  const setupMoveToCategoryImage = () => {
    const categoryImage = document.querySelector('.search__category-image');
    const img = categoryImage?.querySelector('img');
    const wrapper = block.closest('.banner-description-wrapper') || block;

    const hasImage = img
      && img.src
      && !categoryImage.classList.contains('search__category-image--empty');

    if (hasImage && categoryImage) {
      if (!categoryImage.contains(wrapper)) {
        categoryImage.prepend(wrapper);
      }
      wrapper.style.display = '';
      block.style.display = 'flex';
      categoryImage.classList.add('search__category-image--has-banner');
    } else {
      wrapper.style.display = 'none';
      block.style.display = 'none';
      categoryImage?.classList.remove('search__category-image--has-banner');
    }
  };

  setupMoveToCategoryImage();

  // Observer for async category image rendering
  const observer = new MutationObserver(() => {
    setupMoveToCategoryImage();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 4000);
}
