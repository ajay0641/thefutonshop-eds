# Text Band Block

## Overview

A simple centered heading/subheading band with no media. Used for standalone section intros such as the homepage "Healthy Home | Non-Toxic | Handcrafted In California" strip.

## Authoring

A single row containing the heading and optional subheading.

| Text Band |
| :-------- |
| ## Healthy Home \| Non-Toxic \| Handcrafted In California ### Transform your space … |

## Behavior

- `decorate()` lifts each row's contents up to the block's top level so the headings center via CSS.
- No configuration, URL params, local storage, or events.

## Styling

- Centered `h2` (site heading scale) and a smaller muted `h3` subheading; constrained to a readable max-width.
