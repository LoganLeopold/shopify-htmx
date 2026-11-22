import express from 'express';
import { getCollections, getProducts } from '../services/shopify.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    // Fetch featured collections (first 6)
    let collections = [];
    let products = [];
    
    try {
      collections = await getCollections();
    } catch (error) {
      console.error('Failed to fetch collections, using empty array');
      // Continue with empty collections
    }
    
    try {
      const productsResult = await getProducts(null, {
        sort: 'best-selling',
        limit: 8,
      });
      products = productsResult.products || [];
    } catch (error) {
      console.error('Failed to fetch products, using empty array');
      // Continue with empty products
    }
    
    const featuredCollections = collections.slice(0, 6);
    
    res.render('pages/home', {
      collections: featuredCollections,
      products,
      layout: 'layouts/base',
      title: res.locals.siteConfig?.heroTitle || 'Welcome',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
