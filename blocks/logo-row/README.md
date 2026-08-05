# Logo Row Block

## Overview

A centered, wrapping row of press/media logos with consistent logo heights. Used for the homepage "Featured In" section.

## Authoring

Logos may be authored one per row or grouped several per row — both work. The "Featured In" heading is authored as default content (`h2`) above the block.

| Logo Row |
| :------- |
| ![](remodelista.webp) |
| ![](healthline.webp) |

## Behavior

- `decorate()` flattens all `<picture>`/`<img>` across the block's rows/cells into a single `<ul>` of logo items; alt text is read from the DOM.
- No configuration, URL params, local storage, or events.

## Styling

- Centered wrapping flexbox; logo height 48px on mobile, 60px at `min-width: 900px`, capped at four logos per row on desktop.
- Section heading centered via `.logo-row-container .default-content-wrapper h2`.
