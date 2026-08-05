/*
 * Tabs Block
 * A content-driven tabbed / slider panel.
 *
 * Content model: each direct child row of the block is one tab panel. The
 * block wraps the panels in a track, generates numbered indicator buttons,
 * and shows a single panel at a time. Clicking an indicator switches panels.
 *
 * Variant "cards": the FIRST row is treated as a fixed intro/aside (heading,
 * intro copy, call-to-action) shown alongside the panels; the remaining rows
 * are the tab panels. All copy and images are read from the authored DOM.
 */

function showPanel(block, index) {
  const panels = block.querySelectorAll('.tabs-panel');
  const buttons = block.querySelectorAll('.tabs-indicator');
  if (!panels.length) return;
  const target = ((index % panels.length) + panels.length) % panels.length;
  // Number of panels shown per view (cards variant can show more than one).
  const perView = Math.max(1, parseInt(block.dataset.perView || '1', 10));

  panels.forEach((panel, i) => {
    // Reveal `perView` consecutive panels starting at the target index.
    const offset = (((i - target) % panels.length) + panels.length) % panels.length;
    const active = offset < perView;
    panel.hidden = !active;
    panel.setAttribute('aria-hidden', String(!active));
    panel.style.order = active ? String(offset) : '';
    panel.querySelectorAll('a').forEach((link) => {
      if (active) link.removeAttribute('tabindex');
      else link.setAttribute('tabindex', '-1');
    });
  });

  buttons.forEach((button, i) => {
    const active = i === target;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  block.dataset.activePanel = String(target);
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const isCards = block.classList.contains('cards');
  const rows = [...block.children];

  let intro = null;
  let panelRows = rows;
  if (isCards && rows.length > 1) {
    [intro] = rows;
    panelRows = rows.slice(1);
    // Cards slider shows two material cards per view (matches source).
    block.dataset.perView = '2';
  }

  const viewport = document.createElement('div');
  viewport.className = 'tabs-viewport';

  const track = document.createElement('div');
  track.className = 'tabs-panels';

  const nav = document.createElement('div');
  nav.className = 'tabs-indicators';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Select a panel');

  panelRows.forEach((row, i) => {
    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `tabs-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');

    if (!isCards && row.children.length >= 2) {
      // Two-column panel: left = text + icons + link, right = media.
      const [textCell, mediaCell] = row.children;
      textCell.classList.add('tabs-panel-text');
      mediaCell.classList.add('tabs-panel-media');

      // Group the certification icon images (paragraphs that contain images)
      // into a dedicated icon grid so they lay out as rows of badges.
      const iconParas = [...textCell.querySelectorAll(':scope > p')]
        .filter((p) => p.querySelector('picture, img'));
      if (iconParas.length) {
        const icons = document.createElement('div');
        icons.className = 'tabs-icons';
        iconParas.forEach((p) => {
          // One icon per picture (or bare img not inside a picture).
          const nodes = p.querySelector('picture')
            ? p.querySelectorAll(':scope picture')
            : p.querySelectorAll(':scope img');
          nodes.forEach((node) => {
            const item = document.createElement('span');
            item.className = 'tabs-icon';
            item.append(node);
            icons.append(item);
          });
          p.remove();
        });
        // Insert the icon grid before the final link paragraph if present.
        const linkPara = textCell.querySelector(':scope > p:last-of-type');
        if (linkPara && linkPara.querySelector('a')) textCell.insertBefore(icons, linkPara);
        else textCell.append(icons);
      }

      // Convert an mp4 link in the media cell into an inline looping video.
      const mediaLink = mediaCell.querySelector('a[href$=".mp4"]');
      if (mediaLink) {
        const video = document.createElement('video');
        video.src = mediaLink.getAttribute('href');
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        const poster = mediaCell.querySelector('img');
        if (poster) video.poster = poster.getAttribute('src');
        mediaCell.replaceChildren(video);
      }

      panel.append(textCell, mediaCell);
    } else {
      const cell = row.children.length === 1 ? row.firstElementChild : row;
      panel.append(...cell.childNodes);
    }

    track.append(panel);
    row.remove();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tabs-indicator';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-label', `${i + 1} of ${panelRows.length}`);
    button.textContent = String(i + 1);
    button.addEventListener('click', () => showPanel(block, i));
    nav.append(button);
  });

  viewport.append(track);

  if (intro) {
    intro.className = 'tabs-intro';
    const cell = intro.children.length === 1 ? intro.firstElementChild : intro;
    intro.replaceChildren(...cell.childNodes);
    block.append(viewport);
    block.insertBefore(intro, viewport);
  } else {
    block.append(viewport);
  }

  // Indicators: for the cards variant place them at the section level (so they
  // can center at the bottom, full width); otherwise inside the viewport.
  if (isCards) block.append(nav);
  else viewport.append(nav);

  showPanel(block, 0);
}
