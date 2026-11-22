/**
 * Analytics bridge (main thread)
 *
 * The server renders commerce events as inert JSON:
 *   <script type="application/json" data-analytics-event>{...}</script>
 * This module picks them up on first load and after every HTMX swap and hands
 * them to gtag() / klaviyo.push(). In Partytown mode those two globals are
 * Partytown's forwarding stubs, so the vendor code itself never runs here —
 * this file is the only analytics code on the main thread.
 *
 * Every dispatched event is also appended to `window.analyticsLog` for
 * debugging/inspection (and logged when THIRD_PARTY_DEBUG=true).
 */
const config = window.analyticsConfig || {};
const log = (window.analyticsLog = window.analyticsLog || []);

let lastPageViewUrl = null;
let previousUrl = document.referrer || undefined;
let pendingCheckout = null;
let scheduled = false;

function gtag(...args) {
  if (typeof window.gtag === 'function') window.gtag(...args);
}

function klaviyoPush(command) {
  if (window.klaviyo && typeof window.klaviyo.push === 'function') {
    window.klaviyo.push(command);
  }
}

function dispatch(event) {
  if (event.on === 'checkout') {
    // Held until the shopper actually clicks through to checkout.
    pendingCheckout = event;
    return;
  }

  log.push({ ...event, at: Date.now() });
  if (config.debug) console.info('[analytics]', event.name, event);

  if (event.ga4UserId) gtag('set', { user_id: event.ga4UserId });
  if (event.ga4) gtag('event', event.name, event.ga4);
  (event.klaviyo || []).forEach(klaviyoPush);
}

/**
 * hx-boost navigations never reload the page, so GA's automatic page_view
 * would only ever fire once. Send one per distinct URL instead.
 */
function trackPageView() {
  const url = location.href;
  if (url === lastPageViewUrl) return;

  dispatch({
    name: 'page_view',
    ga4: {
      page_location: url,
      page_title: document.title,
      page_referrer: previousUrl,
    },
    klaviyo: [],
  });

  previousUrl = url;
  lastPageViewUrl = url;
}

function flushServerEvents() {
  document
    .querySelectorAll('script[data-analytics-event]:not([data-analytics-sent])')
    .forEach(el => {
      el.setAttribute('data-analytics-sent', '');
      try {
        dispatch(JSON.parse(el.textContent));
      } catch (error) {
        console.warn('[analytics] bad event payload', error);
      }
    });
}

function run() {
  scheduled = false;
  trackPageView();
  flushServerEvents();
}

// One swap can settle several elements; coalesce into a single pass.
function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(run);
}

document.addEventListener('htmx:afterSettle', schedule);
document.addEventListener('htmx:historyRestore', schedule);

/**
 * begin_checkout: checkout lives on Shopify's domain, so this is the last
 * moment we can measure. In Partytown mode the call is relayed to the worker
 * asynchronously and the page would unload first, so hold navigation briefly.
 */
document.addEventListener('click', (e) => {
  if (!pendingCheckout || e.defaultPrevented || e.button !== 0) return;
  const link = e.target.closest?.('a[href]');
  if (!link || link.href !== pendingCheckout.checkoutUrl) return;

  const event = { ...pendingCheckout, on: undefined };
  dispatch(event);

  const opensElsewhere = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank';
  if (config.mode === 'partytown' && !opensElsewhere) {
    e.preventDefault();
    setTimeout(() => { location.href = link.href; }, 300);
  }
}, true);

// Module scripts are deferred, so the initial DOM is ready here.
run();
