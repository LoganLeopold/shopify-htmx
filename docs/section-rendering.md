# Section rendering and the variant picker

The product page is built the way Shopify's Horizon theme builds it: the page
is a set of **sections**, a section is a set of **blocks**, and any section
can be re-rendered on its own through a Section Rendering API that mirrors
Shopify's.

```
views/
  sections/
    main-product.ejs             product page
    featured-product.ejs         home page; same blocks, different layout
    product-recommendations.ejs  lazy-loaded "You may also like"
  blocks/
    variant-picker.ejs  product-price.ejs  buy-buttons.ejs
    variant-meta.ejs    product-gallery.ejs  product-styles.ejs
```

## Section Rendering API

| Request | Response |
| --- | --- |
| `/products/:handle?section_id=main-product` | that section's HTML, wrapped in `<div id="shopify-section-main-product" class="shopify-section">` |
| `/products/:handle?sections=main-product,featured-product` | JSON `{ "main-product": "<html>", "featured-product": "<html>" }` (max 5) |
| `/recommendations/products?product_id=123&limit=4&section_id=product-recommendations` | recommendations section (Storefront `productRecommendations`) |

As on Shopify, a section renders in the context of the URL's resource, and
the usual product URL parameters apply:

- `?variant=<id>` selects a variant (numeric ID or GID).
- `?options[Color]=Blue&options[Size]=M` selects by option values. This is
  what the picker sends, and what the no-JS form submits.

Each route allowlists the sections it can render. Other IDs get a 404.
Section responses are `Cache-Control: private, no-cache`.

## How a variant change works

1. A radio in `<form id="variant-picker-<section>">` changes, and htmx GETs
   the product URL with the form's options plus `section_id`. `hx-sync`
   aborts any in-flight request, so rapid clicks resolve to the last one.
2. The server resolves the variant (`server/lib/variants.js`):
   - an exact match on all options wins;
   - otherwise it keeps the option that just changed (from `HX-Trigger-Name`)
     and picks the closest variant, preferring available ones;
   - option states (sold out / unavailable) are computed per level, like
     Dawn and Horizon: each option's values are judged against the selections
     made in the options before it.
3. The response is the whole section. `hx-select-oob` swaps only the blocks
   that depend on the variant: the picker, price, hidden variant ID,
   add-to-cart button, and SKU/stock line. The quantity input is not swapped,
   so the shopper's quantity is kept. A `role="status"` region keeps its node
   and only has its contents replaced, so screen readers announce the new
   variant.
4. The server also sends an `HX-Trigger: {"variant:update": {...}}` event
   (Horizon dispatches `variant:update` too). `<image-gallery>` listens for
   it and shows the variant's image without being re-rendered.
5. On `main-product` the server sends
   `HX-Replace-Url: /products/:handle?variant=<id>`, so the URL is shareable
   and reload-safe without adding history entries. The featured product
   leaves the URL alone.

Each radio has a stable `id`, so htmx restores keyboard focus after the
picker is swapped. Without JavaScript, the picker is a plain GET form and
the page renders the chosen variant server-side.

## Adding a section

1. Create `views/sections/<id>.ejs` and use `sectionId` to suffix block IDs.
2. Add `<id>` to the route's allowlist (for example `PRODUCT_SECTIONS` in
   `server/routes/products.js`).
3. Include it in a page inside `<div id="shopify-section-<id>" class="shopify-section">`,
   or lazy-load it with `hx-get="…?section_id=<id>" hx-trigger="revealed" hx-swap="outerHTML"`.
