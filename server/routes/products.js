import express from 'express';
import { getProduct, getVariantDetails } from '../services/shopify.js';
import * as analytics from '../lib/analytics-events.js';

const router = express.Router();

// Product detail page
router.get('/:handle', async (req, res, next) => {
  try {
    const { handle } = req.params;
    const product = await getProduct(handle);
    
    if (!product) {
      return res.status(404).render('404', {
        layout: 'layouts/base',
        title: 'Product Not Found',
      });
    }
    
    res.trackAnalytics(analytics.viewItem(product, product.variants[0], analytics.requestOrigin(req)));
    
    res.render('pages/product', {
      product,
      layout: 'layouts/base',
      title: product.title,
    });
  } catch (error) {
    next(error);
  }
});

// Variant details (HTMX endpoint for price updates)
router.get('/:handle/variant-details', async (req, res, next) => {
  try {
    const { variantId } = req.query;
    
    if (!variantId) {
      return res.status(400).send('<div class="error">Variant ID required</div>');
    }
    
    const variant = await getVariantDetails(variantId);
    
    if (!variant) {
      return res.status(404).send('<div class="error">Variant not found</div>');
    }
    
    res.render('partials/product-price', {
      variant,
      layout: false,
    });
  } catch (error) {
    next(error);
  }
});

// Image swap (HTMX endpoint)
router.get('/:handle/image/:index', async (req, res, next) => {
  try {
    const { handle, index } = req.params;
    const product = await getProduct(handle);
    
    if (!product) {
      return res.status(404).send('<div class="error">Product not found</div>');
    }
    
    const imageIndex = parseInt(index, 10);
    const image = product.images[imageIndex];
    
    if (!image) {
      return res.status(404).send('<div class="error">Image not found</div>');
    }
    
    res.send(`
      <img src="${image.url}" 
           alt="${image.altText || product.title}" 
           class="gallery-main__image"
           loading="lazy">
    `);
  } catch (error) {
    next(error);
  }
});

export default router;
