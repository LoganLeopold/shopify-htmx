/**
 * Third-party script integration (Google Analytics 4 + Klaviyo) with Partytown.
 *
 * Three modes, selectable per request with ?third_party=… when overrides are
 * allowed, so the same page can be measured with and without Partytown:
 *
 *   partytown  Vendor scripts run in a web worker. The main thread only runs
 *              Partytown's ~4 kB bootstrap and our tiny event bridge
 *              (public/js/analytics.js).
 *   main       Classic implementation: vendor scripts run on the main thread
 *              exactly as the vendors' install snippets do it.
 *   off        No vendor scripts at all (baseline).
 */
import express from 'express';
import path from 'path';
import { createRequire } from 'module';
import { partytownSnippet } from '@qwik.dev/partytown/integration';
import { config } from '../config.js';

const require = createRequire(import.meta.url);
const partytownPkgDir = path.dirname(require.resolve('@qwik.dev/partytown/package.json'));
const partytownVersion = require('@qwik.dev/partytown/package.json').version;

export const MODES = ['partytown', 'main', 'off'];

const PARTYTOWN_LIB = '/~partytown/';
const PROXY_PATH = '/~partytown-proxy';

/**
 * Hosts whose scripts the Partytown worker loads through our same-origin
 * proxy. Workers fetch scripts with fetch(), which needs CORS headers that
 * vendor CDNs don't reliably send. Exact host matches only — this is not an
 * open proxy.
 */
const PROXIED_SCRIPT_HOSTS = [
  'www.googletagmanager.com',
  'static.klaviyo.com',
  'static-tracking.klaviyo.com',
  'static-forms.klaviyo.com',
];

// Origins each vendor needs in the Content-Security-Policy (main-thread mode
// loads scripts from them; both modes send beacons/XHR to them).
const VENDOR_ORIGINS = {
  ga4: {
    script: ['https://www.googletagmanager.com'],
    connect: [
      'https://www.googletagmanager.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
    ],
    font: [],
  },
  klaviyo: {
    script: ['https://*.klaviyo.com'],
    connect: ['https://*.klaviyo.com'],
    font: ['https://*.klaviyo.com', 'https://fonts.gstatic.com'],
  },
};

const tp = config.thirdParty;

function enabledVendors() {
  return [
    tp.ga4MeasurementId && 'ga4',
    tp.klaviyoCompanyId && 'klaviyo',
  ].filter(Boolean);
}

/**
 * Builds the Partytown bootstrap snippet once at startup. `resolveUrl` is
 * serialized into the snippet and runs inside the worker, so the host list is
 * baked into its source rather than captured in a closure.
 */
function buildPartytownSnippet() {
  const resolveUrl = new Function('url', 'location', 'type', `
    var hosts = ${JSON.stringify(PROXIED_SCRIPT_HOSTS)};
    if (type === 'script' && hosts.indexOf(url.hostname) !== -1) {
      var proxied = new URL(${JSON.stringify(PROXY_PATH)}, location.origin);
      proxied.searchParams.set('url', url.href);
      return proxied;
    }
    return url;
  `);

  return partytownSnippet({
    lib: PARTYTOWN_LIB,
    debug: tp.debug,
    // Calls made on the main thread are queued and replayed in the worker.
    forward: ['dataLayer.push', 'gtag', 'klaviyo.push'],
    resolveUrl,
  });
}

const snippet = buildPartytownSnippet();

function resolveMode(req) {
  const requested = req.query.third_party;
  if (tp.allowModeOverride && MODES.includes(requested)) return requested;
  return MODES.includes(tp.mode) ? tp.mode : 'partytown';
}

/**
 * Per-request middleware: picks the mode, exposes template locals and gives
 * routes `res.trackAnalytics(event)` to queue commerce events. Runs before
 * helmet, since the CSP depends on the mode.
 */
export function thirdPartyMiddleware(req, res, next) {
  const vendors = enabledVendors();
  const mode = vendors.length ? resolveMode(req) : 'off';
  const queued = [];

  res.locals.thirdParty = {
    mode,
    debug: tp.debug,
    ga4MeasurementId: tp.ga4MeasurementId,
    klaviyoCompanyId: tp.klaviyoCompanyId,
    scriptType: mode === 'partytown' ? 'text/partytown' : 'text/javascript',
    partytownSnippet: mode === 'partytown' ? snippet : '',
    partytownVersion,
  };

  res.trackAnalytics = (event) => {
    if (mode !== 'off' && event) queued.push(event);
  };
  res.locals.analyticsQueue = queued;

  next();
}

/**
 * Serializes queued events into the rendered HTML as inert JSON <script> tags
 * that public/js/analytics.js picks up — on first load and after every HTMX
 * swap. Register after the layout middleware so it sees the final HTML.
 */
export function analyticsEventsMiddleware(req, res, next) {
  const queued = res.locals.analyticsQueue || [];
  const render = res.render.bind(res);
  res.render = (view, options = {}, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (callback) return render(view, options, callback);

    render(view, options, (err, html) => {
      if (err) return next(err);
      res.send(injectEvents(html, queued));
    });
  };

  next();
}

function serializeEvent(event) {
  // Escape "<" so a product title can never close the <script> element.
  const json = JSON.stringify(event).replace(/</g, '\\u003c');
  return `<script type="application/json" data-analytics-event>${json}</script>`;
}

function injectEvents(html, events) {
  if (!events.length) return html;
  const tags = events.map(serializeEvent).join('');
  const bodyClose = html.lastIndexOf('</body>');
  if (bodyClose === -1) return html + tags;
  return html.slice(0, bodyClose) + tags + html.slice(bodyClose);
}

/**
 * Content-Security-Policy directives for helmet. Vendor origins are added only
 * for vendors that are configured; Partytown additionally needs blob: workers
 * and 'unsafe-eval' (it executes vendor code in the worker with new Function),
 * which is scoped to requests actually running in Partytown mode.
 */
export function contentSecurityPolicyDirectives() {
  const vendors = enabledVendors();
  const pick = (kind) => vendors.flatMap(v => VENDOR_ORIGINS[v][kind]);
  const partytownOnly = (value) => (req, res) =>
    res.locals.thirdParty?.mode === 'partytown' ? value : "'self'";

  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', ...pick('script'), partytownOnly("'unsafe-eval'")],
    workerSrc: ["'self'", partytownOnly('blob:')],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:', 'http:'],
    fontSrc: ["'self'", 'data:', ...pick('font')],
    connectSrc: ["'self'", ...pick('connect')],
  };
}

/**
 * Routes: Partytown's worker/service-worker files must be served from our own
 * origin, plus the allowlisted script proxy used by `resolveUrl`.
 */
export function thirdPartyRouter() {
  const router = express.Router();

  router.use(PARTYTOWN_LIB, express.static(path.join(partytownPkgDir, 'lib'), {
    // Not fingerprinted, so don't let the global 1y immutable policy apply.
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600'),
  }));

  router.get(PROXY_PATH, async (req, res) => {
    let target;
    try {
      target = new URL(String(req.query.url || ''));
    } catch {
      return res.status(400).send('Invalid url');
    }

    if (target.protocol !== 'https:' || !PROXIED_SCRIPT_HOSTS.includes(target.hostname)) {
      return res.status(403).send('Host not allowed');
    }

    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': req.get('user-agent') || 'shopify-htmx' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      if (!upstream.ok) {
        return res.status(upstream.status).send(`Upstream responded ${upstream.status}`);
      }

      res.set('Content-Type', upstream.headers.get('content-type') || 'application/javascript');
      // Vendors version these URLs by query string; a short cache keeps tags
      // fresh while avoiding a proxy round-trip on every navigation.
      res.set('Cache-Control', 'public, max-age=300');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      console.error('Partytown proxy error:', target.href, error.message);
      res.status(502).send('Upstream fetch failed');
    }
  });

  return router;
}
