/** View helpers exposed to every template via app.locals. */
const formatters = new Map();

export function formatMoney(money) {
  if (!money) return '';
  const currency = money.currencyCode || 'USD';
  if (!formatters.has(currency)) {
    formatters.set(currency, new Intl.NumberFormat('en-US', { style: 'currency', currency }));
  }
  return formatters.get(currency).format(Number(money.amount));
}

/** "gid://shopify/Product/123" -> "123" */
export const legacyId = (gid) => (gid ? String(gid).split('/').pop() : '');
