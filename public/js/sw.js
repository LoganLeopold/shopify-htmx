// Service Worker - McMaster-Carr inspired caching strategy
const CACHE_NAME = 'shopify-htmx-v1';
const STATIC_CACHE = 'static-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/css/reset.css',
  '/css/tokens.css',
  '/css/base.css',
  '/js/components/search-box.js',
  '/js/components/cart-drawer.js',
  '/js/components/image-gallery.js',
  '/js/components/price-range.js',
  'https://unpkg.com/htmx.org@1.9.10',
  'https://unpkg.com/htmx.org/dist/ext/head-support.js',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          try {
            return new Request(url, { mode: 'no-cors' });
          } catch (e) {
            return url;
          }
        }));
      })
      .catch(err => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map(name => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy for HTML
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Network-first failed, trying cache:', error);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate for pages
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    // Ignore fetch errors, use cache
  });
  
  return cached || fetchPromise;
}

// Fetch: route to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Static assets: cache-first
  if (
    url.pathname.match(/\.(css|js|jpg|jpeg|png|webp|woff2|woff|ttf|svg)$/i) ||
    url.hostname === 'unpkg.com' ||
    url.hostname.includes('cdn.shopify.com')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // HTML pages: stale-while-revalidate
  if (
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname === '/' ||
    !url.pathname.includes('.')
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  
  // Everything else: network-first
  event.respondWith(networkFirst(request));
});
