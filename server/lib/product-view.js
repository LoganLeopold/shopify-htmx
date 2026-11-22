/**
 * Template data shared by every product section (main product, featured
 * product), so a variant change renders identically wherever the picker is.
 */
import { resolveVariant, optionStates, hasOnlyDefaultVariant, variantImageIndex } from './variants.js';

/**
 * Picker params from the query string. htmx sends the triggering radio and
 * the whole form, so a value can arrive twice, and qs turns that into an
 * array. The last value wins.
 */
export function selectionFromRequest(req) {
  const raw = req.query.options && typeof req.query.options === 'object' ? req.query.options : {};
  const options = Object.fromEntries(
    Object.entries(raw).map(([name, value]) => [name, Array.isArray(value) ? value[value.length - 1] : value])
  );

  // htmx sends the triggering element's name, e.g. "options[Color]".
  const triggerName = req.get('HX-Trigger-Name') || '';
  const changedOption = (triggerName.match(/^options\[(.+)\]$/) || [])[1];

  const variantId = typeof req.query.variant === 'string' ? req.query.variant : undefined;
  return { variantId, options, changedOption };
}

export function productSectionData(product, selection = {}) {
  const variant = resolveVariant(product, selection);
  return {
    product,
    variant,
    options: optionStates(product, variant),
    showOptions: !hasOnlyDefaultVariant(product),
    selectedImageIndex: variantImageIndex(product, variant),
  };
}
