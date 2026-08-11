# TFS Newsletter Block

## Overview

The TFS Newsletter block provides email newsletter subscription using the `@ajay0641/tfs-newsletter` drop-in `NewsletterContainer`. It submits addresses through Magento’s `subscribeEmailToNewsletter` GraphQL mutation on the core commerce endpoint.

## Integration

<!-- ### Block Configuration

No block configuration is read via `readBlockConfig()`. -->

<!-- ### URL Parameters

No URL parameters directly affect this block's behavior. -->

<!-- ### Local Storage

No localStorage keys are used by this block. -->

### Events

#### Event Listeners

No direct event listeners are implemented in this block.

#### Event Emitters

Events are emitted by the drop-in (not the block wrapper):

- `newsletter/subscribed` — payload `{ email, status }` after a successful subscription
- `newsletter/error` — payload `{ email, message }` when subscription fails

## Behavior Patterns

### Page Context Detection

- **All Users**: Renders the newsletter email field and subscribe control for guests and authenticated customers
- **Authoring**: Empty block named **TFS Newsletter** (class `tfs-newsletter`); no content rows required

### User Interaction Flows

1. **Initialization**: Block loads `scripts/initializers/newsletter.js`, wires `CORE_FETCH_GRAPHQL` via `setEndpoint`, and mounts the drop-in
2. **Form Display**: Renders email input and subscribe button (labels from drop-in defaults or `placeholders/newsletter.json` when present)
3. **Validation**: Client-side required/email format checks before calling the API
4. **Subscribe**: Calls `subscribeToNewsletter` (GraphQL `subscribeEmailToNewsletter`)
5. **Success / Error**: On success the form shows a status line under the email field (`Thank you for your subscription.` by default) and emits `newsletter/subscribed`. Validation/API failures use the error line and `newsletter/error`.

> **Note:** After upgrading `@ajay0641/tfs-newsletter` with npm, run `npm run install:dropins` so `scripts/__dropins__/tfs-newsletter` matches `node_modules`. The browser loads the drop-in from `__dropins__` via the import map, not from `node_modules` directly.

### Error Handling

- **Validation Errors**: Invalid or empty email is handled in the container before the mutation runs
- **API Errors**: GraphQL and network failures surface as container error messaging and `newsletter/error`
- **Placeholder Fetch Errors**: Missing `placeholders/newsletter.json` falls back to drop-in default copy
- **Fallback Behavior**: Drop-in defaults always provide usable labels when CMS placeholders are unavailable

### Drop-in Dependency

| Package | Path after install |
|---------|-------------------|
| `@ajay0641/tfs-newsletter` | `scripts/__dropins__/tfs-newsletter/` (copied by `postinstall.js`) |

Import map entry (in `head.html`): `@ajay0641/tfs-newsletter/` → `/scripts/__dropins__/tfs-newsletter/`
