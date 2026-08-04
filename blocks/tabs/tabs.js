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

  panels.forEach((panel, i) => {
    const active = i === target;
    panel.hidden = !active;
    panel.setAttribute('aria-hidden', String(!active));
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
    const cell = row.children.length === 1 ? row.firstElementChild : row;
    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `tabs-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.append(...cell.childNodes);
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

  viewport.append(track, nav);

  if (intro) {
    intro.className = 'tabs-intro';
    const cell = intro.children.length === 1 ? intro.firstElementChild : intro;
    intro.replaceChildren(...cell.childNodes);
    block.append(viewport);
    block.insertBefore(intro, viewport);
  } else {
    block.append(viewport);
  }

  showPanel(block, 0);
}
