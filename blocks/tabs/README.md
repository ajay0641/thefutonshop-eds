# Tabs Block

## Overview

A content-driven tabbed / slider panel. Each authored row is one panel; the block generates numbered dot indicators and shows one panel (or, in the `cards` variant, two) at a time. Clicking an indicator switches panels. Used for the homepage "Farm to Furniture" story slider (default variant) and "Certified Organic Ingredients" material slider (`cards` variant).

## Authoring

### Default variant

Each row is a two-cell panel: left = heading + copy (+ optional icon images + link), right = media (image, or an `.mp4` link that becomes an inline autoplay/muted/loop video).

| Tabs |
| :--- |
| ## The Futon Shop … [Learn more](/x) | ![](media.jpg) |

### Cards variant (`tabs cards`)

The first row is a fixed intro/aside (heading + copy + CTA). Each remaining row is a material card: image + heading + caption (rendered as a white overlay at the top of the image).

| Tabs (cards) |
| :----------- |
| ## Certified Organic Ingredients … [LEARN MORE](/x) |
| ![](cotton.jpg) ### Organic Cotton, USDA Certified Organic Cotton |

## Behavior / Integration

### Data attributes
- `data-per-view` — panels shown per view. Set to `2` automatically for the `cards` variant; defaults to `1`.
- `data-active-panel` — index of the current panel (managed internally).

No `readBlockConfig` keys, URL params, local storage, or events.

### Interaction
- Numbered indicators (`role="tab"`) switch the visible panel(s); links in hidden panels get `tabindex="-1"`.

## Styling

- Default: two-column panel (text left, media right) at `min-width: 900px`; certification icons render in a 4-column grid.
- Cards: two square (1:1) cards per view side-by-side with white overlaid heading/caption and a top gradient; beige section background with a full-bleed sage strip behind the centered dot indicators at the section bottom.

## Accessibility

- `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-hidden`; hidden-panel links are removed from tab order.
