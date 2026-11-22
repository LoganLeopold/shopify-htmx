# Third-party scripts with Partytown

The classic Shopify marketing stack (Google Analytics 4 via gtag.js and
Klaviyo onsite tracking via klaviyo.js) is wired in three switchable modes,
so you can measure what those tags cost and check that the data merchants rely
on still arrives.

| Mode | What runs on the main thread |
| --- | --- |
| `partytown` (default) | Partytown's inline bootstrap snippet (~4 kB) and the small event bridge in `public/js/analytics.js`. gtag.js and klaviyo.js run in a web worker. |
| `main` | The vendors' own install snippets, exactly as their docs describe. |
| `off` | Nothing third-party. This is the baseline. |

## Setup

```bash
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
KLAVIYO_COMPANY_ID=AbC123          # Klaviyo public API key / site ID
THIRD_PARTY_MODE=partytown         # partytown | main | off
THIRD_PARTY_DEBUG=false            # console logging, Partytown debug build, GA4 DebugView
THIRD_PARTY_ALLOW_OVERRIDE=        # default: on outside production
```

A vendor is only loaded when its ID is set. If neither is set the mode is
forced to `off`.

## Comparing modes

When overrides are allowed, append `?third_party=main|partytown|off` to any
URL. The mode then holds for the rest of the session's HTMX navigations,
because the shell (and its `<head>`) never reloads.

```bash
npx lighthouse "http://localhost:3000/products/some-handle?third_party=main" --only-categories=performance
npx lighthouse "http://localhost:3000/products/some-handle?third_party=partytown" --only-categories=performance
npx lighthouse "http://localhost:3000/products/some-handle?third_party=off" --only-categories=performance
```

Look at **Total Blocking Time** and **INP** rather than load time. Partytown
doesn't make the vendor code smaller; it moves its parsing and execution off
the main thread. A local run with stand-in vendor scripts, each set to burn
150 ms of CPU, measured:

| Mode | Long tasks on main thread | TBT |
| --- | --- | --- |
| off | none | 0 ms |
| main | 150 ms, 150 ms | ~200 ms |
| partytown | none | 0 ms |

Run it against a real store and real tags before drawing conclusions.
Klaviyo in particular loads extra modules (signup forms, back-in-stock) on
demand.

## What gets measured

`page_view` is sent by the bridge itself, once per distinct URL. HTMX
navigations never reload the page, so GA's automatic page view would only
fire once. All other events are rendered by the server
(`server/lib/analytics-events.js`) as inert
`<script type="application/json" data-analytics-event>` tags inside the HTML
being returned. `public/js/analytics.js` dispatches them on first load and
after every HTMX swap.

| Trigger | GA4 event (recommended ecommerce schema) | Klaviyo |
| --- | --- | --- |
| Any page / HTMX navigation | `page_view` (`page_location`, `page_title`, `page_referrer`) | klaviyo.js tracks *Active on Site* itself |
| Product page | `view_item` | *Viewed Product* + `trackViewedItem` (recently viewed) |
| Collection page | `view_item_list` (`item_list_id`, `item_list_name`, indexed items) | — |
| Search results | `search` (`search_term`) | *Searched Site* |
| Add to cart (HTMX POST) | `add_to_cart` (quantity added, line value) | *Added to Cart* (full cart `Items`, `$value`, `CheckoutURL`) |
| Cart page | `view_cart` | — |
| Click on checkout link | `begin_checkout` | *Started Checkout* |
| Account dashboard (logged in) | `user_id` (customer ID only, no PII) | `identify` (email, first/last name) |

GA4 item fields: `item_id` (SKU, falling back to the numeric variant ID),
`item_name`, `item_brand` (vendor), `item_category` (product type),
`item_variant`, `price`, `quantity`. Klaviyo product IDs use the numeric
Shopify product ID, which is what Klaviyo's Shopify catalog sync keys on, so
events join up with catalog data in flows and recommendations.

Purchases are not tracked client-side. Checkout and the thank-you page run on
Shopify, so `purchase` / *Placed Order* should come from Shopify's own GA4 and
Klaviyo integrations (or a Customer Events web pixel), as on any headless
storefront.

## How the Partytown wiring works

- **Lib files** are served from `/~partytown/` out of `node_modules` (the
  version is pinned in `package.json`), so there is no copy step.
- **Forwarding:** `dataLayer.push`, `gtag` and `klaviyo.push` are forwarded.
  On the main thread they are Partytown stubs that queue calls and replay them
  in the worker, where the real vendor code runs.
- **Script proxy:** workers load scripts with `fetch()`, which needs CORS
  headers that vendor CDNs don't reliably send. `resolveUrl` rewrites script
  URLs for an exact-match host allowlist to `/~partytown-proxy?url=…`. That
  route refuses any other host, so it is not an open proxy.
- **CSP:** vendor origins are added only for configured vendors. Partytown
  needs `worker-src blob:` and `script-src 'unsafe-eval'` because it executes
  vendor code with `new Function` in the worker. Both are only sent on
  responses rendered in `partytown` mode.

## Caveats and findings

- **Exit events race the unload.** Forwarded calls reach the worker
  asynchronously, so a click that leaves the site can unload the page before
  the beacon is sent. For the checkout link the bridge holds navigation for
  300 ms in Partytown mode, and not at all for modifier-clicks or new tabs.
  Any other outbound tracking needs the same treatment.
- **Klaviyo signup forms touch the DOM a lot.** They work through Partytown,
  since DOM access is proxied synchronously, but every DOM read is a round trip
  to the main thread. Check form render time and interactions on a real store.
  If they're sluggish, a middle ground is to keep forms on the main thread with
  Partytown's `loadScriptsOnMainThread` and leave tracking in the worker.
- **GA4 enhanced measurement.** Page views come from the bridge (with
  `send_page_view: false` on the config call), because gtag in the worker
  can't reliably observe the main thread's `pushState`. In the GA4 data stream
  settings, turn off "Page changes based on browser history events" so `main`
  mode doesn't double count.
- **Consent:** neither mode implements Consent Mode or a cookie banner yet.
  When added, call `gtag('consent', …)` (forwarded) before the bridge's first
  dispatch.
