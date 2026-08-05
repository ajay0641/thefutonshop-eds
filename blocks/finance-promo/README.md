# Finance Promo Block

## Overview

A horizontal financing/offer band: a logo, headings, a short line of copy, and a call-to-action button. Used for the homepage Synchrony financing band ("12 MONTHS | NO INTEREST" + "SEE IF YOU QUALIFY").

## Authoring

Rows contain, in order: a logo image, one or more headings, a paragraph, and a CTA link.

| Finance Promo |
| :------------ |
| ![](synchrony-logo.webp) |
| ## EXCLUSIVE ONLINE & IN-STORE OFFER |
| ## 12 MONTHS \| NO INTEREST |
| AFFORDABLE MONTHLY PAYMENT |
| [SEE IF YOU QUALIFY](https://etail.mysynchrony.com/...) |

## Behavior

- `decorate()` reads all copy/image/link from the authored DOM (nothing hardcoded), classes the CTA link as a button, and opens absolute (external) CTA URLs in a new tab.
- No configuration, URL params, local storage, or events.

## Styling

- Dark band background with white text; bordered/solid CTA button with hover state.
- Mobile-first: stacked/centered on mobile; horizontal row with space-between at `min-width: 900px`.
