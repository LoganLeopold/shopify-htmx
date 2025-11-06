import express from 'express';
import { getCollections, getCollection, getProducts } from '../services/shopify.js';

const router = express.Router();

// Collection list
router.get('/', async (req, res, next) => {
  try {
    const collections = await getCollections();
    
    if (res.locals.isHTMX) {
      return res.render('pages/collection-list', {
        collections,
        layout: false,
      });
    }
    
    res.render('pages/collection-list', {
      collections,
      layout: 'layouts/base',
      title: 'Collections',
    });
  } catch (error) {
    next(error);
  }
});

// Single collection with products
router.get('/:handle', async (req, res, next) => {
  try {
    const { handle } = req.params;
    const { sort, available, price_max, page } = req.query;
    
    const collection = await getCollection(handle);
    
    if (!collection) {
      return res.status(404).render('404', {
        layout: 'layouts/base',
        title: 'Collection Not Found',
      });
    }
    
    const options = {
      sort: sort || 'best-selling',
      available,
      priceMax: price_max,
      page: parseInt(page || '1', 10),
      limit: 24,
    };
    
    const { products, hasNextPage, endCursor } = await getProducts(handle, options);
    
    // HTMX request with query params: return only product grid
    if (res.locals.isHTMX && (sort || available || price_max)) {
      return res.render('partials/product-grid', {
        products,
        hasNextPage,
        endCursor,
        page: options.page,
        collectionHandle: handle,
        layout: false,
      });
    }
    
    // HTMX request: return full collection page (no layout)
    if (res.locals.isHTMX) {
      return res.render('pages/collection', {
        collection,
        products,
        hasNextPage,
        endCursor,
        currentPage: options.page,
        filters: { sort, available, price_max },
        layout: false,
      });
    }
    
    // Full page request
    res.render('pages/collection', {
      collection,
      products,
      hasNextPage,
      endCursor,
      currentPage: options.page,
      filters: { sort, available, price_max },
      layout: 'layouts/base',
      title: collection.title,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
