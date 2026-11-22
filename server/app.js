import express from 'express';
import session from 'express-session';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import {
  thirdPartyMiddleware,
  analyticsEventsMiddleware,
  thirdPartyRouter,
  contentSecurityPolicyDirectives,
} from './lib/third-party.js';

// Import middleware
import htmxMiddleware from './middleware/htmx.js';
import renderLayoutMiddleware from './middleware/render-layout.js';
import cartMiddleware from './middleware/cart.js';
import authMiddleware from './middleware/auth.js';
import layoutMiddleware from './middleware/layout.js';
import performanceMiddleware from './middleware/performance.js';

// Import routes
import indexRoutes from './routes/index.js';
import collectionRoutes from './routes/collections.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import searchRoutes from './routes/search.js';
import accountRoutes from './routes/account.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Third-party script mode (Partytown / main thread / off) — must run before
// helmet because the CSP depends on the mode chosen for this request.
app.use(thirdPartyMiddleware);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: contentSecurityPolicyDirectives(),
  },
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.server.env === 'production',
    httpOnly: true,
    maxAge: config.session.maxAge,
    sameSite: 'lax',
  },
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.set('view cache', config.server.env === 'production');

// Static files with performance middleware
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1y',
  immutable: true,
}));

// Partytown lib files + allowlisted script proxy (before session/layout so
// worker requests don't create sessions or hit the Storefront API)
app.use(thirdPartyRouter());

// Global middleware (order matters)
app.use(performanceMiddleware);
app.use(htmxMiddleware);
app.use(renderLayoutMiddleware);
app.use(analyticsEventsMiddleware);
app.use(cartMiddleware);
app.use(authMiddleware);
app.use(layoutMiddleware);

// Routes
app.use('/', indexRoutes);
app.use('/collections', collectionRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/search', searchRoutes);
app.use('/account', accountRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const message = config.server.env === 'production' 
    ? 'Something went wrong' 
    : err.message;
  
  if (res.locals.isHTMX) {
    return res.status(status).send(`<div class="error">${message}</div>`);
  }
  
  res.status(status).render('error', {
    message,
    layout: 'layouts/base',
    title: 'Error',
  });
});

// 404 handler
app.use((req, res) => {
  if (res.locals.isHTMX) {
    return res.status(404).send('<div class="error">Page not found</div>');
  }
  
  res.status(404).render('404', {
    layout: 'layouts/base',
    title: 'Page Not Found',
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${config.server.env}`);
});

export default app;
