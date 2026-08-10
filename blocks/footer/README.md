# Footer Block

## Overview

The Footer block loads site footer content from a CMS fragment and decorates it into content bands: newsletter, service row, link columns, and bottom bar. Relative fragment images are resolved to the The Futon Shop media CDN. When multistore is enabled, a store-view switcher button and modal are also rendered.

## Integration

### Block Configuration

No block configuration is read via `readBlockConfig()`. Footer paths and multistore behavior come from page metadata and drop-in config.

<!-- ### URL Parameters

No URL parameters directly affect this block's behavior. -->

<!-- ### Local Storage

No localStorage keys are used by this block. -->

### Events

#### Event Listeners

No direct event listeners are implemented in this block.

#### Event Emitters

No events are emitted by this block. Newsletter subscribe events are emitted by the TFS Newsletter drop-in when that block is present in the footer fragment.

### Metadata

| Metadata | Default | Description |
|----------|---------|-------------|
| `footer` | `/footer` | Path to the footer fragment (resolved relative to the page URL when set as a full URL) |

### Fragments

| Path | When loaded | Description |
|------|-------------|-------------|
| Footer path (`footer` meta or `/footer`) | Always | Main footer content sections |
| `/store-switcher` | Multistore only | Store view list for the switcher modal |

## Behavior Patterns

### Fragment loading

1. **Load**: `loadFragment(footerPath)` fetches `.plain.html`, runs `decorateMain` and `loadSections`
2. **Nested blocks**: Nested blocks in the fragment (for example **TFS Newsletter**) are decorated and loaded by the fragment pipeline before the footer applies layout classes
3. **Empty host**: The footer block’s existing content is cleared; fragment sections are moved into a wrapper `div` and appended

### Content bands

After load, top-level fragment sections are classified:

| Band class | How selected | Decoration |
|------------|--------------|----------|
| `footer-newsletter` | Section that contains `.tfs-newsletter` / `.tfs-newsletter-wrapper`, else first remaining section | Class only; form UI and band styles live on the TFS Newsletter block |
| `footer-service` | Next remaining section | Groups children starting at each image into `.footer-service-col` (icon + body + CTA) |
| `footer-links` | Next remaining section | Groups children starting at each `h2`–`h4` into `.footer-link-col`; last column lists → `.footer-social` / `.footer-certifications` |
| `footer-bottom` | Last remaining section | Class only |

### Newsletter (authored in da.live)

1. Authors place the **TFS Newsletter** block (and optional promo copy) in the footer fragment section used as the newsletter band
2. `loadFragment` loads/decorates that block (GraphQL subscribe via `@ajay0641/tfs-newsletter`)
3. Footer JS only adds `footer-newsletter` on the section so newsletter block CSS can style the footer band
4. Newsletter form and band styles live in `blocks/tfs-newsletter/tfs-newsletter.css`, not `footer.css`

### Media resolution

- Fragment image `src` values under `images/` (or containing `/images/`) are rewritten to `https://www.thefutonshop.com/media/wysiwyg/…` (with overrides such as `newtfs-24-logo.png`)
- Images set `loading="lazy"` after rewrite

### Links

- External `http(s)` links whose host is not this site and not `*.thefutonshop.com` open in a new tab (`rel="noopener"`)
- Links inside `.footer-social` always open in a new tab

### Multistore switcher

When `isMultistore()` is true:

1. Loads `/store-switcher` fragment (failure logs and aborts footer decorate)
2. Renders a drop-in `Button` showing the store name matching the current root path
3. Click opens a modal with region/store lists; multi-store regions use accordion expand/collapse (click + keyboard)

### User Interaction Flows

1. **Scroll to footer**: Bands display as structured in the fragment (newsletter → services → links → bottom)
2. **Subscribe**: User enters email in the TFS Newsletter form; drop-in validates and calls Magento `subscribeEmailToNewsletter`
3. **Service / nav links**: Normal navigation; external and social links open in a new tab as above
4. **Store switcher (multistore)**: User opens modal, expands regions if needed, and chooses a store path

### Error Handling

- **Missing footer fragment**: `loadFragment` returns null; append would fail if callers do not guard (fragment is expected to be published)
- **Missing store-switcher fragment (multistore)**: Error is logged and decorate returns early without appending footer content
- **Missing newsletter block**: Section still gets `footer-newsletter` if it is the first fallback section; no form is injected by the footer
- **Malformed external URLs**: Silently ignored when setting `target`/`rel`

## Authoring notes (footer fragment)

Suggested section order:

1. **Newsletter** — promo text + **TFS Newsletter** block  
2. **Service** — icon, heading, copy, and CTA per service (columns start at each image)  
3. **Links** — link groups (columns start at each heading); last column for social + certifications  
4. **Bottom** — logo and copyright / legal line  

Use portable relative image paths under `images/` so the footer JS can resolve them to the media CDN.
