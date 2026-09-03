# Breadcrumb Block

## Overview

The Breadcrumb block renders a visible category trail on **Product List Page (PLP)**, **Product Details Page (PDP)**, and **Cart** views. It is auto-injected by `buildBreadcrumbBlock()` in `scripts/scripts.js` when a page contains a `product-list-page`, `product-details`, or `commerce-cart` block and breadcrumbs are enabled.

The block uses the drop-in `Breadcrumbs` component from `@dropins/tools/components.js` and resolves category data from the current URL and Catalog Service.

Category **names** on PLP are rendered separately by the `product-list-page` block (`search__category-title`, before `search__result-info`). This block handles the navigation trail only.

## Configuration Options

The breadcrumb block has no authored block fields. Visibility is controlled by page metadata:

| Metadata key | Values | Effect |
|--------------|--------|--------|
| `breadcrumb` | `auto` (default) | Show breadcrumbs on PLP/PDP/cart when auto-injected. |
| `breadcrumb` | `off`, `false`, `none` | Remove the breadcrumb section from the page. |

Example metadata block on a category template:

```
metadata

breadcrumb: auto
```

The `metadata` block `breadcrumb: auto` value is also used by SEO/bulk metadata tooling. It controls whether this **visible** breadcrumb UI is shown; it does not generate JSON-LD on its own.

## Integration

### Auto-injection

During eager page decoration, `scripts.js` prepends a section with an empty `.breadcrumb` block above the PLP, PDP, or cart block when:

1. No `.breadcrumb` block already exists on the page, and
2. A `.product-list-page`, `.product-details`, or `.commerce-cart` block is present.

Authors can also place a `breadcrumb` block manually in a template section if preferred; auto-injection is skipped when one already exists.

### Data Sources

| Page type | Source | Trail |
|-----------|--------|-------|
| **PLP** | `getCategoryFromUrl()` + `getCategoryAncestors()` from `scripts/menu-data.js` | `Home` → parent categories → current category |
| **PDP** | `events.on('pdp/data')` + deepest product category + `getCategoryAncestors()` | `Home` → category ancestors → product name |
| **Cart** | Static cart page label | `Home` → `Shopping Cart` |

Category links use `getCategoryLink(urlPath, categoryId)` (`/categories/{urlPath}/{categoryId}`).

### Events

#### Event Listeners

- `events.on('pdp/data', callback, { eager: true })` – **PDP only.** Waits for product data, resolves the deepest assigned category, builds the ancestor chain, and renders breadcrumbs with the product name as the final crumb.

The block does not emit events.

### Local Storage

This block does not use localStorage or sessionStorage.

## Behavior Patterns

### Product List Page

1. Reads category context from the URL via `getCategoryFromUrl()`.
2. Fetches the full ancestor chain for the category `urlPath`.
3. Renders `Home` plus each category in the chain. Parent categories are links; the current category is plain text.

Supported URL shapes include canonical paths (`/categories/apparel/6`) and template fallbacks (`/categories/default?cp=apparel/6`).

### Product Details Page

1. Subscribes to `pdp/data` before the PDP block finishes loading.
2. Selects the deepest category assigned to the product.
3. Renders `Home` → category ancestors (linked) → product name (plain text).

If the product has no categories, only `Home` is shown.

### Error Handling

- If breadcrumbs are disabled via metadata, the block section is removed during decoration.
- If no category can be resolved on PLP, the block renders an empty trail (Home only).
- Category ancestor lookup is cached in memory by `menu-data.js` for the session.

## Related Blocks

| Block | Role |
|-------|------|
| `product-list-page` | Renders the category **heading** (`search__category-title`) above result count on category pages. |
| `metadata` | Controls breadcrumb visibility via the `breadcrumb` metadata key. |
