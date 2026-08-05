# Feature Grid Block

## Overview

A promotional tile grid arranged as a staggered mosaic: a tall featured tile on the left plus a 2×2 grid of alternating wide/narrow tiles on the right. Each tile is a clickable image; the category name is baked into the image, so the authored heading and "Shop Now" link are kept in the DOM (for accessibility/SEO) but visually hidden. Used for the homepage "50 Years of Handcrafting" and lower 5-tile promo grids.

## Authoring

One row per tile: image, overlay heading text, and a link.

| Feature Grid |
| :----------- |
| ![](mattresses.webp) | Up To 45% off | [Shop Now](/mattresses) |
| ![](pillows.webp)    | Wake Up Refreshed | [Shop Now](/pillows) |

The first authored tile becomes the tall featured tile. Section heading/subheading are authored as default content (`h2`/`h3`) above the block.

## Behavior

- `decorate()` builds a `<ul>` of tile `<a>`s, each wrapping the image and a visually-hidden caption (heading + Shop Now). First tile gets `feature-grid-tile-featured`.
- No configuration, URL params, local storage, or events.

## Styling

- Desktop (`min-width: 900px`): 12-column grid — featured tile spans columns 1–5 and both rows; the four right tiles alternate wide/narrow between rows for the offset mosaic.
- Mobile: single-column stack.
- Section heading + subheading centered via `.feature-grid-container .default-content-wrapper` rules.
