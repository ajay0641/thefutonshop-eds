# Promo Banner Block

## Overview

A single full-width promotional banner: one or more images wrapped in a single link, so the whole banner is clickable. Multi-image banners (e.g. a photo + a promo graphic) sit side-by-side on desktop and stack on mobile. Used for the homepage "30% Off Box-Stitched Mattress Topper" and "Futon Mattress Guide" banners.

## Authoring

A single row whose cell contains the picture(s) and the target link.

| Promo Banner |
| :----------- |
| ![](topper-photo.jpg) ![](topper-text.jpg) [Shop the topper](/topper) |

## Behavior

- `decorate()` collects the pictures and the first `a[href]`, wraps every picture in one `<a>`, and sets its `aria-label` from the link text (falling back to the first image's alt). With no link it degrades to a non-linked wrapper.
- Multi-image banners get a `promo-banner-multi` class.
- No configuration, URL params, local storage, or events.

## Styling

- Single image: full-width responsive image. Multi-image: stacked on mobile, 50/50 side-by-side at `min-width: 900px`.
