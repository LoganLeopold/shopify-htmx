import express from 'express';
import { searchProducts, getProducts } from '../services/shopify.js';
import * as analytics from '../lib/analytics-events.js';

const router = express.Router();

// Predictive search (HTMX endpoint)
router.get('/predictive', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.send('<div class="search-results-empty">Type at least 2 characters</div>');
    }
    
    const products = await searchProducts(q.trim(), 5);
    
    if (products.length === 0) {
      return res.send(`
        <div class="search-results-empty">
          <p>No results found</p>
          <a href="/search?q=${encodeURIComponent(q)}">View all results</a>
        </div>
      `);
    }
    
    res.render('partials/search-predictive', {
      products,
      query: q,
      layout: false,
    });
  } catch (error) {
    next(error);
  }
});

// Full search results page
router.get('/', async (req, res, next) => {
  try {
    const { q, sort, available, price_max, page } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.render('pages/search', {
        query: '',
        products: [],
        hasNextPage: false,
        layout: 'layouts/base',
        title: 'Search',
      });
    }
    
    const query = q.trim();
    
    // For search, we'll use the searchProducts function and also apply filters
    let products = await searchProducts(query, 50); // Get more results for filtering
    
    // Apply filters client-side (or refine the query)
    if (available === 'true') {
      products = products.filter(p => p.variant?.availableForSale);
    }
    
    if (price_max) {
      products = products.filter(
        p => parseFloat(p.price.amount) <= parseFloat(price_max)
      );
    }
    
    // Paginate
    const currentPage = parseInt(page || '1', 10);
    const perPage = 24;
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedProducts = products.slice(start, end);
    const hasNextPage = end < products.length;
    
    // If HTMX request with filters: return product grid only
    if (res.locals.isHTMX && (sort || available || price_max || page)) {
      return res.render('partials/product-grid', {
        products: paginatedProducts,
        hasNextPage,
        page: currentPage,
        query,
        layout: false,
      });
    }
    
    res.trackAnalytics(analytics.search(query, products));
    
    // Full page request
    res.render('pages/search', {
      query,
      products: paginatedProducts,
      hasNextPage,
      currentPage,
      filters: { sort, available, price_max },
      layout: 'layouts/base',
      title: `Search: ${query}`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
