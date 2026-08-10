import { getRootPath, isMultistore } from '@dropins/tools/lib/aem/configs.js';
// Dropin Components
import {
  Button,
  provider as UI,
} from '@dropins/tools/components.js';

// Block-level
import createModal from '../modal/modal.js';
import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// Base URL for footer media assets on the source CDN. The fragment references
// images by relative path (images/<file>) so it stays portable for authoring;
// at render time we resolve them to their hosted location.
const MEDIA_BASE = 'https://www.thefutonshop.com/media/wysiwyg/';
const MEDIA_OVERRIDES = {
  'newtfs-24-logo.png': `${MEDIA_BASE}homepagenew/newtfs-24-logo.png`,
};

/**
 * Resolves a relative fragment image path to its hosted source URL.
 * @param {string} src The image src as authored (e.g. images/facebook-footer.webp)
 * @returns {string} Absolute URL to the hosted asset
 */
function resolveMediaSrc(src) {
  const file = (src || '').split('/').pop();
  if (!file) return src;
  return MEDIA_OVERRIDES[file] || `${MEDIA_BASE}${file}`;
}

/**
 * Rewrites all relative fragment image sources to their hosted URLs.
 * @param {Element} scope The footer root element
 */
function resolveImages(scope) {
  scope.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('images/') || src.includes('/images/')) {
      img.src = resolveMediaSrc(src);
      img.loading = 'lazy';
    }
  });
}

/**
 * Groups a flat list of sibling nodes into column wrappers, starting a new
 * column each time the predicate matches a node.
 * @param {Element} wrapper The content wrapper holding the flat nodes
 * @param {(node: Element) => boolean} isColumnStart Predicate marking a new column
 * @param {string} colClass Class applied to each generated column wrapper
 */
function groupIntoColumns(wrapper, isColumnStart, colClass) {
  const nodes = [...wrapper.children];
  const columns = [];
  let current = null;
  nodes.forEach((node) => {
    if (isColumnStart(node) || !current) {
      current = document.createElement('div');
      current.className = colClass;
      columns.push(current);
    }
    current.append(node);
  });
  wrapper.append(...columns);
}

/**
 * Decorates the footer fragment into the four content bands, styles the
 * authored TFS Newsletter block (from da.live), groups service and link
 * columns, and resolves media.
 * Newsletter drop-in is already loaded via loadFragment → decorateMain/loadSections.
 * @param {Element} footer The footer root containing the appended fragment
 */
function decorateFooterContent(footer) {
  resolveImages(footer);

  const sections = [...footer.querySelectorAll(':scope > .section')];
  // Prefer the section that contains the authored TFS Newsletter block.
  const newsletterFromBlock = footer.querySelector(
    ':scope > .section:has(.tfs-newsletter), :scope > .section:has(.tfs-newsletter-wrapper)',
  );
  const remaining = sections.filter((s) => s !== newsletterFromBlock);
  const newsletter = newsletterFromBlock || remaining.shift();
  const [service, links, bottom] = remaining;

  if (newsletter) {
    newsletter.classList.add('footer-newsletter');
  }

  if (service) {
    service.classList.add('footer-service');
    const wrapper = service.querySelector('.default-content-wrapper') || service;
    // Each service column begins with an image (icon).
    groupIntoColumns(
      wrapper,
      (node) => node.querySelector && node.querySelector('img'),
      'footer-service-col',
    );
    // Restructure each column into an icon cell + body cell so the icon sits
    // left of the heading, with description and CTA button below.
    wrapper.querySelectorAll('.footer-service-col').forEach((col) => {
      const iconP = col.querySelector('p:has(img), p > img')?.closest('p') || col.querySelector('p');
      const iconImg = col.querySelector('img');
      if (iconImg) {
        iconImg.classList.add('footer-service-icon');
        const iconCell = document.createElement('div');
        iconCell.className = 'footer-service-icon-wrap';
        iconCell.append(iconImg);
        const body = document.createElement('div');
        body.className = 'footer-service-body';
        // Move all remaining nodes (except the now-empty icon paragraph) into body.
        [...col.children].forEach((node) => {
          if (node === iconP) return;
          body.append(node);
        });
        if (iconP && iconP.parentElement === col) iconP.remove();
        col.append(iconCell, body);
        // Tag the last link as the CTA button.
        const ctaLinks = body.querySelectorAll('a');
        const cta = ctaLinks[ctaLinks.length - 1];
        if (cta) cta.classList.add('footer-service-cta');
      }
    });
  }

  if (links) {
    links.classList.add('footer-links');
    const wrapper = links.querySelector('.default-content-wrapper') || links;
    // Each link column begins with a heading.
    groupIntoColumns(
      wrapper,
      (node) => /^H[2-4]$/.test(node.tagName),
      'footer-link-col',
    );
    // Tag the social icon list and the certification ("We love organic") block
    // inside the final (Follow Us) column.
    const lastCol = wrapper.querySelector('.footer-link-col:last-child');
    if (lastCol) {
      const lists = lastCol.querySelectorAll('ul');
      if (lists[0]) lists[0].classList.add('footer-social');
      if (lists[1]) lists[1].classList.add('footer-certifications');
    }
  }

  if (bottom) {
    bottom.classList.add('footer-bottom');
  }

  // Open external and social links in a new tab.
  footer.querySelectorAll('a[href^="http"]').forEach((a) => {
    try {
      const url = new URL(a.href);
      if (url.hostname !== window.location.hostname
        && !url.hostname.endsWith('thefutonshop.com')) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    } catch (_) { /* ignore malformed hrefs */ }
    // Social icon links always open in a new tab.
    if (a.closest('.footer-social')) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });
}

/**
 * Toggles all storeSelector sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleStoreDropdown(sections, expanded = false) {
  sections
    .querySelectorAll('.storeview-modal .default-content-wrapper > ul > li')
    .forEach((section) => {
      section.setAttribute('aria-expanded', expanded);
    });
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const root = getRootPath();
  // Load Footer as Fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');

  // Footer content - Store Switcher
  if (isMultistore()) {
    footer.innerHTML = `
      <div class="storeview-switcher-button"></div>
    `;

    // Container and component refs
    let modal;

    // Modal Actions
    const showModal = async (content) => {
      modal = await createModal([content]);
      modal.showModal();
    };

    // Rendering the Store Switcher Modal Content
    const $storeSwitcherBtn = footer.querySelector(
      '.storeview-switcher-button',
    );

    // Store Switcher Modal Content
    const storeSwitcherPath = '/store-switcher';
    let fragmentStoreView;

    try {
      fragmentStoreView = await loadFragment(storeSwitcherPath);
      if (!fragmentStoreView) throw new Error(`Footer does not render due to Store Switcher fragment (${storeSwitcherPath}) not found`);
    } catch (error) {
      console.error('Error loading store switcher fragment:', error);
      return;
    }

    // Store Switcher Modal Content
    const storeSwitcher = document.createElement('div');

    // Return Storename from stores-switcher
    const selected = [...fragmentStoreView.querySelectorAll('a')].find((a) => {
      const url = new URL(a.href);
      return url.pathname.startsWith(root);
    });

    storeSwitcher.id = 'storeview-modal';
    while (fragmentStoreView.firstElementChild) {
      storeSwitcher.append(fragmentStoreView.firstElementChild);
    }

    // create classes for storeview modal sections
    const classes = ['storeview-title', 'storeview-list'];
    classes.forEach((c, i) => {
      const section = storeSwitcher.children[i];
      if (section) section.classList.add(`storeview-modal-${c}`);
    });

    // Store Switcher Modal Content - Store View Title
    const storeViewTitle = storeSwitcher.querySelector('.storeview-modal-storeview-title');
    const title = storeViewTitle.querySelector('h3');
    if (title) {
      title.className = '';
      title.closest('h3').classList.add('storeview-modal-storeview-title');
      title.setAttribute('tabindex', '0');
    }

    // Storeview List
    const storeViewList = storeSwitcher.querySelector('.storeview-modal-storeview-list');

    if (storeViewList && storeViewList.children.length) {
      // Add storeview-selection class to parent UL
      storeViewList
        .querySelectorAll(':scope .default-content-wrapper > ul')
        .forEach((storeView) => {
          if (storeView.querySelector('ul')) storeView.classList.add('storeview-selection');
        });

      // if multiple stores exist per region, add class storeviews and click events for accordion
      storeViewList.querySelectorAll('.default-content-wrapper > ul > li > ul').forEach((storeRegion) => {
        if (storeRegion.children.length > 1) {
          if (storeRegion.querySelector('ul')) storeRegion.classList.add('storeviews');

          // Accessiblity: addeventlistener for 'click' and keyboard event and tab indexes
          storeViewList.querySelectorAll(':scope li').forEach((storeView) => {
            const link = storeView.closest('a');
            if (link) link.setAttribute('tabindex', '0');
            storeView.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                const expanded = storeView.getAttribute('aria-expanded') === 'true';
                toggleStoreDropdown(storeViewList);
                storeView.setAttribute('aria-expanded', expanded ? 'false' : 'true');
              }
            });
            storeView.addEventListener('click', () => {
              const expanded = storeView.getAttribute('aria-expanded') === 'true';
              toggleStoreDropdown(storeViewList);
              storeView.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            });
          });
        }
      });

      // If only one storeview link in region, convert parent UL into the li and remove the child UL
      storeViewList.querySelectorAll('.default-content-wrapper > ul > li > ul').forEach((storeRegion) => {
        const li = storeRegion.closest('li');

        if (storeRegion.children.length <= 1) {
          li.classList.add('storeview-single-store');
          const ulParent = li.closest('ul');
          const replacedChild = (storeRegion.firstElementChild);
          replacedChild.className = 'storeview-single-store';

          ulParent.replaceChild(replacedChild, li);
          ulParent.setAttribute('tabindex', '0');
        } else {
          li.classList.add('storeview-multiple-stores');
          li.setAttribute('tabindex', '0');
        }
      });

      UI.render(Button, {
        children: `${selected.text}`,
        'data-testid': 'storeview-switcher-button',
        className: 'storeview-switcher-button',
        size: 'medium',
        variant: 'teritary',
        onClick: () => {
          showModal(storeSwitcher);
        },
      })($storeSwitcherBtn);
    }
  }
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  decorateFooterContent(footer);

  block.append(footer);
}
