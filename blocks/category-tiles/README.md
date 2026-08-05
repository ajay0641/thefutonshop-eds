# Category Tiles Block

## Overview

A responsive row of portrait category tiles. Each tile is an image with a labelled link below it (e.g. "MATTRESSES >"); the whole tile is clickable. Used for the homepage category navigation (Mattresses / Pillows / Sofas / Natural Bed Frames).

## Authoring

One row per tile. Each row has two cells: the image and the label link.

| Category Tiles |
| :------------- |
| ![](mattress.webp) | [MATTRESSES >](/mattresses) |
| ![](pillow.webp)   | [PILLOWS >](/pillows) |

## Behavior

- `decorate()` reads each row, builds a single clickable `<a>` wrapping the image plus the label, and lays the tiles out in a grid.
- No configuration, URL params, local storage, or events.

## Styling

- Portrait images (aspect-ratio 315/386), square corners, centered label below.
- Responsive: 2 columns on mobile, 4 columns at `min-width: 900px`.
- A section heading placed above the block (as default content) is centered via `.category-tiles-container .default-content-wrapper h1`.

## Accessibility

- The tile link's `aria-label` is derived from the label text (trailing `>` removed).
