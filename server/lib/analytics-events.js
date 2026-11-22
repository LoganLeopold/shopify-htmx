/**
 * Commerce event builders.
 *
 * Each builder returns a vendor-ready payload so the browser-side bridge
 * (public/js/analytics.js) stays a dumb dispatcher:
 *
 *   {
 *     name:    'view_item',              // our event name (GA4 naming)
 *     ga4:     { ...event params },      // -> gtag('event', name, ga4)
 *     klaviyo: [ ['track', ...], ... ],  // -> klaviyo.push(command) each
 *     on:      'checkout'                // optional: defer until checkout click
 *   }
 *
 * Field names follow GA4's recommended ecommerce schema and Klaviyo's
 * documented onsite events ("Viewed Product", "Added to Cart", "Started
 * Checkout", trackViewedItem, identify), which is what Shopify merchants'
 * existing reports, audiences and flows are built on.
 */

/** "gid://shopify/Product/123" -> "123" (what Klaviyo's Shopify catalog uses). */
export function legacyId(gid) {
  return gid ? String(gid).split('/').pop() : undefined;
}

const toNumber = (money) => (money ? Number(money.amount) : undefined);
const round = (n) => Math.round(n * 100) / 100;
const compact = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
);

function productUrl(origin, handle) {
  return `${origin}/products/${handle}`;
}

/** GA4 `items[]` entry. */
function ga4Item({ product, variant, quantity = 1, index, listName }) {
  return compact({
    item_id: variant?.sku || legacyId(variant?.id) || legacyId(product.id),
    item_name: product.title,
    item_brand: product.vendor,
    item_category: product.productType,
    item_variant: variant && variant.title !== 'Default Title' ? variant.title : undefined,
    price: toNumber(variant?.priceV2 || product.priceRange?.minVariantPrice || product.price),
    quantity,
    index,
    item_list_name: listName,
  });
}

export function viewItem(product, variant, origin) {
  variant = variant || product.variants?.[0];
  const price = toNumber(variant?.priceV2);
  const currency = variant?.priceV2?.currencyCode;
  const url = productUrl(origin, product.handle);
  const image = product.images?.[0]?.url;
  const categories = product.productType ? [product.productType] : [];

  return {
    name: 'view_item',
    ga4: { currency, value: price, items: [ga4Item({ product, variant })] },
    klaviyo: [
      ['track', 'Viewed Product', compact({
        ProductName: product.title,
        ProductID: legacyId(product.id),
        SKU: variant?.sku,
        Categories: categories,
        ImageURL: image,
        URL: url,
        Brand: product.vendor,
        Price: price,
        CompareAtPrice: toNumber(variant?.compareAtPriceV2),
      })],
      // Powers Klaviyo's "recently viewed items" blocks in emails.
      ['trackViewedItem', compact({
        Title: product.title,
        ItemId: legacyId(product.id),
        Categories: categories,
        ImageUrl: image,
        Url: url,
        Metadata: compact({ Brand: product.vendor, Price: price, CompareAtPrice: toNumber(variant?.compareAtPriceV2) }),
      })],
    ],
  };
}

export function viewItemList(listId, listName, products) {
  return {
    name: 'view_item_list',
    ga4: {
      item_list_id: listId,
      item_list_name: listName,
      items: products.map((product, index) => ga4Item({
        product, variant: product.variant, index, listName,
      })),
    },
    klaviyo: [],
  };
}

export function search(term, products) {
  return {
    name: 'search',
    ga4: { search_term: term },
    klaviyo: [['track', 'Searched Site', { SearchTerm: term, ReturnedResults: products.length }]],
  };
}

function cartLineToGa4(line) {
  const variant = line.merchandise;
  return ga4Item({ product: variant.product, variant, quantity: line.quantity });
}

function cartTotals(cart) {
  return {
    currency: cart.cost?.totalAmount?.currencyCode,
    value: toNumber(cart.cost?.totalAmount),
  };
}

function klaviyoCartItems(cart, origin) {
  return cart.lines.map(line => {
    const v = line.merchandise;
    const price = toNumber(v.priceV2);
    return compact({
      ProductID: legacyId(v.product?.id),
      SKU: v.sku,
      ProductName: v.product?.title,
      Quantity: line.quantity,
      ItemPrice: price,
      RowTotal: price !== undefined ? round(price * line.quantity) : undefined,
      ProductURL: v.product?.handle ? productUrl(origin, v.product.handle) : undefined,
      ImageURL: v.image?.url,
    });
  });
}

/**
 * @param cart   the cart after the add
 * @param variantId the variant that was added
 * @param quantity  how many were added in this action (not the line total)
 */
export function addToCart(cart, variantId, quantity, origin) {
  const line = cart?.lines?.find(l => l.merchandise?.id === variantId);
  if (!line) return null;

  const variant = line.merchandise;
  const price = toNumber(variant.priceV2);
  const value = price !== undefined ? round(price * quantity) : undefined;

  return {
    name: 'add_to_cart',
    ga4: {
      currency: variant.priceV2?.currencyCode,
      value,
      items: [{ ...cartLineToGa4(line), quantity }],
    },
    klaviyo: [['track', 'Added to Cart', compact({
      $value: toNumber(cart.cost?.totalAmount),
      AddedItemProductName: variant.product?.title,
      AddedItemProductID: legacyId(variant.product?.id),
      AddedItemSKU: variant.sku,
      AddedItemImageURL: variant.image?.url,
      AddedItemURL: variant.product?.handle ? productUrl(origin, variant.product.handle) : undefined,
      AddedItemPrice: price,
      AddedItemQuantity: quantity,
      ItemNames: cart.lines.map(l => l.merchandise?.product?.title),
      CheckoutURL: cart.checkoutUrl,
      Items: klaviyoCartItems(cart, origin),
    })]],
  };
}

export function viewCart(cart) {
  if (!cart?.lines?.length) return null;
  return {
    name: 'view_cart',
    ga4: { ...cartTotals(cart), items: cart.lines.map(cartLineToGa4) },
    klaviyo: [],
  };
}

/**
 * Deferred: the bridge holds onto this and fires it when a link to
 * `checkoutUrl` is clicked, since checkout happens on Shopify's domain.
 */
export function beginCheckout(cart, origin) {
  if (!cart?.lines?.length) return null;
  return {
    name: 'begin_checkout',
    on: 'checkout',
    checkoutUrl: cart.checkoutUrl,
    ga4: { ...cartTotals(cart), items: cart.lines.map(cartLineToGa4) },
    klaviyo: [['track', 'Started Checkout', compact({
      $event_id: `${legacyId(cart.id)}_${Date.now()}`,
      $value: toNumber(cart.cost?.totalAmount),
      ItemNames: cart.lines.map(l => l.merchandise?.product?.title),
      CheckoutURL: cart.checkoutUrl,
      Items: klaviyoCartItems(cart, origin),
    })]],
  };
}

/**
 * Logged-in customer. GA4 only gets an opaque user_id (sending email or other
 * PII to GA violates Google's terms); Klaviyo gets the profile it keys on.
 */
export function identify(customer) {
  if (!customer?.email) return null;
  return {
    name: 'identify',
    ga4: null,
    ga4UserId: legacyId(customer.id),
    klaviyo: [['identify', compact({
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
    })]],
  };
}

/** Origin of the current request, for absolute product URLs. */
export function requestOrigin(req) {
  return `${req.protocol}://${req.get('host')}`;
}
