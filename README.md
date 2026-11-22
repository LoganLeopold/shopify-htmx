# Shopify HTMX Storefront

A hyper-optimized, headless Shopify storefront built with Express, HTMX, and Web Components. Features server-side rendering, progressive enhancement, and aggressive performance optimizations inspired by the "market for lemons" philosophy.

## Features

- **No JavaScript Frameworks** - Pure server-rendered HTML with HTMX for progressive enhancement
- **Web Components** - Custom elements for dynamic features (search, cart drawer, image gallery, price range)
- **CSS Nouveau Architecture** - Design tokens, component-scoped styles, co-located CSS
- **Performance Optimized** - Service worker caching, lazy loading, resource hints, compression
- **HTMX Navigation** - Persistent shell with instant content swaps (no full page reloads)
- **Hybrid Filtering** - URL updates with HTMX content swaps (SEO-friendly + fast)
- **Cart Management** - Server-side cart ID persistence with drawer + full page
- **Custom Account Pages** - Complete customer portal without redirecting to Shopify
- **Dual Search** - Predictive dropdown + full search results page
- **Third-party tags off the main thread** - GA4 + Klaviyo via [Partytown](https://partytown.qwik.dev/), switchable per request (`?third_party=partytown|main|off`) for side-by-side measurement. See [docs/third-party-scripts.md](docs/third-party-scripts.md)

## Prerequisites

- Node.js 18+ (ES modules)
- A Shopify store with Storefront API access
- Storefront Access Token from Shopify admin

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your Shopify credentials:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```
   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_storefront_access_token
   SHOPIFY_API_VERSION=2024-01
   SESSION_SECRET=your_secret_session_key
   PORT=3000
   NODE_ENV=development

   # Optional: third-party tags (see docs/third-party-scripts.md)
   GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   KLAVIYO_COMPANY_ID=your_klaviyo_public_key
   THIRD_PARTY_MODE=partytown   # partytown | main | off
   THIRD_PARTY_DEBUG=false
   ```

3. **Get your Shopify Storefront Access Token:**
   - Go to Shopify Admin → Settings → Apps and sales channels
   - Click "Develop apps" → Create an app
   - Configure Storefront API scopes (read products, read collections, etc.)
   - Install app and copy the Storefront API access token

4. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

## Architecture

### Stack

- **Backend:** Express.js with EJS templating
- **Shopify Integration:** GraphQL via `graphql-request`
- **Frontend:** HTMX + Web Components
- **Styling:** Vanilla CSS with CSS Nouveau principles
- **Performance:** Service Worker, compression, caching headers

### Project Structure

```
shopify-htmx/
├── server/
│   ├── app.js              # Express setup
│   ├── config.js           # Environment config
│   ├── routes/             # Route handlers
│   ├── services/           # Shopify API client
│   └── middleware/         # Cart, HTMX, auth, layout, performance
├── views/
│   ├── layouts/
│   │   └── base.ejs        # Shell with HTMX setup
│   ├── pages/              # Full page templates
│   ├── partials/           # Reusable components
│   └── components/         # Additional components
└── public/
    ├── css/                # Design tokens, base styles
    └── js/
        └── components/     # Web Components
```

### Key Patterns

**HTMX Navigation:**
- `hx-boost="true"` on main content area auto-AJAXifies all links
- Only main content swaps, header/footer persist
- URL updates via `hx-push-url="true"` for bookmark-able filters

**Cart Management:**
- Cart ID stored in server session (httpOnly cookie)
- All cart operations return HTML partials via HTMX
- Cart drawer + full cart page share same operations

**CSS Architecture:**
- Global design tokens in `tokens.css`
- Component-scoped styles in `<style>` tags within templates
- Follows CSS Nouveau principles (semantic tokens, minimal reset)

**Performance:**
- Service worker caches static assets (cache-first)
- HTML pages use stale-while-revalidate
- Images lazy-loaded with native `loading="lazy"`
- Shopify CDN image transforms (WebP, responsive sizes)

## Usage

### Routes

- `/` - Homepage with featured collections/products
- `/collections` - All collections list
- `/collections/:handle` - Single collection with filtering
- `/products/:handle` - Product detail page
- `/cart` - Full cart page
- `/search` - Search results
- `/account` - Customer dashboard (requires auth)
- `/account/login` - Login page
- `/account/register` - Registration page
- `/account/orders` - Order history

### HTMX Endpoints

- `/search/predictive` - Predictive search dropdown
- `/cart/drawer` - Cart drawer content
- `/cart/summary` - Header cart summary
- `/cart/add` - Add to cart (POST)
- `/cart/update` - Update quantity (POST)
- `/cart/remove` - Remove item (POST)
- `/products/:handle/variant-details` - Variant price update

### Customization

**Design Tokens:**
Edit `public/css/tokens.css` to customize colors, spacing, typography, etc.

**Site Config:**
Store configuration in Shopify metafields (namespace: `theme`):
- `primary_color` - Site primary color
- `hero_title` - Homepage hero title
- `hero_description` - Homepage hero description

**Components:**
All templates use inline `<style>` tags for component-scoped CSS. Modify templates in `views/` to customize appearance.

## Performance Targets

- First Contentful Paint: < 1s
- Time to Interactive: < 2s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Total Blocking Time: < 200ms
- Lighthouse Score: 95+

## Development

The project uses ES modules (`"type": "module"` in package.json). All imports should use ES6 syntax:

```javascript
import express from 'express';
```

For development, use `npm run dev` which uses Node's `--watch` flag for auto-reload.

## License

MIT
