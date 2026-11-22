/**
 * Variant selection helpers, modelled on Shopify theme behaviour
 * (product.selected_or_first_available_variant + Dawn/Horizon option
 * availability). They are computed from the product's variant list, so they
 * work on any Storefront API version. The newer
 * `selectedOrFirstAvailableVariant` / `encodedVariantAvailability` fields need
 * 2024-07+, and this app defaults to 2024-01.
 */

/** Plain single-variant products ("Title: Default Title") have no real options. */
export function hasOnlyDefaultVariant(product) {
  return product.variants.length === 1
    && product.options.length === 1
    && product.options[0].values.length === 1
    && product.variants[0].selectedOptions?.[0]?.value === 'Default Title';
}

const optionValue = (variant, name) =>
  variant.selectedOptions?.find(o => o.name === name)?.value;

const matches = (variant, selection) =>
  Object.entries(selection).every(([name, value]) => optionValue(variant, name) === value);

function firstAvailable(variants) {
  return variants.find(v => v.availableForSale) || variants[0];
}

/**
 * Resolve the variant to show, the way a Shopify product URL does:
 *   1. ?variant=<id> (numeric legacy id or GID)
 *   2. options[Name]=Value for every option -> exact match
 *   3. no exact match (the combination doesn't exist): keep the option the
 *      shopper just changed and pick the closest variant (most other options
 *      kept), preferring available ones
 *   4. otherwise the first available variant
 *
 * @param {object} product  product from getProduct()
 * @param {object} params
 * @param {string} [params.variantId]
 * @param {object} [params.options]        { [optionName]: value }
 * @param {string} [params.changedOption]  name of the option that changed
 */
export function resolveVariant(product, { variantId, options, changedOption } = {}) {
  const { variants } = product;
  if (!variants?.length) return null;

  if (variantId) {
    const id = String(variantId);
    const byId = variants.find(v => v.id === id || v.id.endsWith(`/${id}`));
    if (byId) return byId;
  }

  const selection = Object.fromEntries(
    Object.entries(options || {}).filter(([name, value]) =>
      typeof value === 'string' && product.options.some(o => o.name === name && o.values.includes(value)))
  );

  if (Object.keys(selection).length) {
    const exact = variants.find(v => matches(v, selection));
    if (exact) return exact;

    const anchor = selection[changedOption] !== undefined
      ? { [changedOption]: selection[changedOption] }
      : {};
    const candidates = variants.filter(v => matches(v, anchor));
    const score = (v) => Object.entries(selection).filter(([n, val]) => optionValue(v, n) === val).length;
    const ranked = [...(candidates.length ? candidates : variants)]
      .sort((a, b) => (score(b) - score(a)) || (b.availableForSale - a.availableForSale));
    if (ranked.length) return ranked[0];
  }

  return firstAvailable(variants);
}

/**
 * Picker state for each option value, relative to the selected variant.
 * Like Dawn/Horizon, an option's values are judged against the selections
 * of the options *before* it:
 *   exists    some variant has this value combined with the earlier selections
 *   available ...and at least one of those variants is available for sale
 */
export function optionStates(product, selectedVariant) {
  return product.options.map((option, index) => {
    const earlier = Object.fromEntries(
      product.options.slice(0, index).map(o => [o.name, optionValue(selectedVariant, o.name)])
    );
    const selectedValue = optionValue(selectedVariant, option.name);

    return {
      name: option.name,
      selectedValue,
      values: option.values.map(value => {
        const pool = product.variants.filter(v => matches(v, { ...earlier, [option.name]: value }));
        return {
          value,
          selected: value === selectedValue,
          exists: pool.length > 0,
          available: pool.some(v => v.availableForSale),
        };
      }),
    };
  });
}

/** Index of the variant's image within product.images (-1 if none). */
export function variantImageIndex(product, variant) {
  const src = variant?.image?.url;
  if (!src) return -1;
  // product.images URLs carry CDN transform params appended to the original.
  return product.images.findIndex(image => image.url.startsWith(src));
}

/** "gid://shopify/ProductVariant/123" -> "123" */
export const legacyId = (gid) => String(gid).split('/').pop();
