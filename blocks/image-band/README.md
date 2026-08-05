# Image Band Block

## Overview

A full-width row of two or more images (optionally linked) that stack vertically on mobile and sit side-by-side on desktop. Panels are sized in proportion to each image's intrinsic aspect ratio and share a common height, so unequal-width bands (e.g. a text panel next to a photo grid) match the source. Used for several homepage bands: 50th Anniversary, Timeless Japanese, Japanese Selection, OKI Frames, Kids, Customizable Sofas, and Visit Our Showrooms.

## Authoring

One row per image. Each cell holds a picture, optionally wrapped in (or accompanied by) a link.

| Image Band |
| :--------- |
| [![](left.jpg)](/link) |
| [![](right.jpg)](/link) |

## Behavior

- `decorate()` classes each row as an item; if a cell has both a picture and a link it wraps the picture in the link.
- Each item's `flex-grow` is set from its image's natural width/height ratio so widths come out proportional at a shared height (equal-ratio images render 50/50).
- No configuration, URL params, local storage, or events.

## Styling

- Mobile: column stack. Desktop (`min-width: 900px`): row, items share height via `align-items: stretch`.
- Section headings placed above the band (default content `h2`/`h3`) are centered via `.image-band-container` rules.
- Section style hooks: `.timeless-section` / `.discover-section` (column gap), `.explore-our-section` (max-width) — applied via a `section-metadata` `style` value.
