# Banner Description Block

## Overview

The `banner-description` block renders promotional text content that integrates dynamically with category hero images (`.search__category-image`) on Product List Pages (PLPs). When a category image is present, the block combines with the image to produce a split-screen banner (32% text panel and 68% full-height image).

If no category image is available on the page, the block is automatically hidden.

## Authoring

Author a single table cell containing the promotional lines or paragraphs:

| Banner Description |
| :----------------- |
| **LABOR DAY SALE**<br>**Up To 50% Off**<br>## Sale Ends Sept 7th<br>Handcrafted In San Francisco \| America's Best Factory Direct Mattresses & Futons Since 1976 |

Or authored as individual rows/cells:

| Banner Description |
| :----------------- |
| **LABOR DAY SALE** |
| **Up To 50% Off** |
| ## Sale Ends Sept 7th |
| Handcrafted In San Francisco \| America's Best Factory Direct Mattresses & Futons Since 1976 |

### Element Mapping

- **Top Tag (`.banner-description__tag`)**: The first text line (e.g. `LABOR DAY SALE`). Rendered in uppercase bold white text (`1.8rem`).
- **Pill Badge (`.banner-description__badge`)**: The discount/offer text containing percentages or "Up To" (e.g. `Up To 50% Off`). Rendered as a cream badge (`#eaeae3`) with dark text (`#5f665a`).
- **Heading / Title (`.banner-description__title`)**: The main heading element or sale title (e.g. `Sale Ends Sept 7th`). Rendered in large white typography (`36px`).
- **Subtext (`.banner-description__text`)**: The descriptive footer paragraph. Rendered in clean white text (`18px`).

## Behavior & Logic

- **Integration with Category Hero**: When `.search__category-image` contains a category image (`<img>`), `.banner-description-wrapper` moves inside `.search__category-image` to build the combined hero banner.
- **Fallback Handling**: If `.search__category-image` has no image, `.banner-description-wrapper` sets `display: none` and does not display on the page.
- **Dynamic Mutation Handling**: Uses a `MutationObserver` to ensure integration occurs seamless even when category images load asynchronously via GraphQL or dropins.

## Styling

- **Layout Ratios**: On viewports >= 768px, split layout allocates **32%** width to the description panel and **68%** width to the category image.
- **Image Stretching**: Category image scales with `object-fit: cover` and absolute positioning to fill 100% of the banner height without leaving white space.
- **Theme Color**: Background panel uses dark sage green (`#556255`).
