# TFS Product Slider Block

## Overview

The TFS Product Slider block renders a horizontal product carousel using the `@ajay0641/tfs-product-slider` drop-in `ProductSliderContainer`. Products are loaded from Adobe Commerce **Catalog Service** via `productSearch` (default filter: `isNew = 1`).

## Integration

### Block Configuration

| Configuration Key | Type | Default | Description | Required |
|-------------------|------|---------|-------------|----------|
| `title` | string | `''` | Heading above the slider | No |
| `phrase` | string | `''` | Catalog Service search phrase | No |
| `page-size` | string/number | `8` | Number of products to fetch | No |
| `current-page` | string/number | `1` | productSearch page | No |
| `filter-attribute` | string | `isNew` | Search filter attribute name | No |
| `filter-eq` | string | `1` | Filter equality value | No |

<!-- ### URL Parameters

No URL parameters directly affect this block's behavior. -->

<!-- ### Local Storage

No localStorage keys are used by this block. -->

### Events

#### Event Listeners

No direct event listeners are implemented in this block.

#### Event Emitters

Events are emitted by the drop-in (not the block wrapper):

- `product-slider/loaded` — result payload after products load
- `product-slider/error` — `{ message }` when the fetch fails
- `product-slider/product-click` — product item when a card is clicked

## Behavior Patterns

### Page Context Detection

- **All pages**: Renders a product slider wherever authors place **TFS Product Slider**
- **Authoring**: Key/value rows for title, phrase, page size, and filter; empty block uses drop-in defaults (isNew products)

### User Interaction Flows

1. **Initialization**: Block loads `scripts/initializers/product-slider.js`, wires `CS_FETCH_GRAPHQL` via `setEndpoint`, and mounts the drop-in
2. **Fetch**: Calls Catalog Service `productSearch` with authored phrase/pageSize/filter (or defaults)
3. **PDP links**: Block remaps product URLs to storefront routes via `getProductLink(urlKey, sku)` (`/products/{urlKey}/{sku}`)
4. **Navigation**: Users scroll the track or use previous/next controls when more than one product is present
5. **Product open**: Card click navigates to the product detail page

### Error Handling

- **API Errors**: GraphQL/network failures show container error copy and emit `product-slider/error`
- **Empty results**: Container shows empty status message
- **Placeholder Fetch Errors**: Missing `placeholders/product-slider.json` falls back to drop-in default labels
- **Invalid page size**: Non-numeric page size falls back to `8`

### Drop-in Dependency

| Package | Path after install |
|---------|-------------------|
| `@ajay0641/tfs-product-slider` | `scripts/__dropins__/tfs-product-slider/` (copied by `postinstall.js`) |

Import map entry (in `head.html`): `@ajay0641/tfs-product-slider/` → `/scripts/__dropins__/tfs-product-slider/`

After upgrading the npm package, run:

```bash
npm run install:dropins
```
