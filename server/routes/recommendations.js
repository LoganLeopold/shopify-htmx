/**
 * /recommendations/products: Shopify's product recommendations endpoint,
 * served through the Section Rendering API:
 *   /recommendations/products?product_id=123&limit=4&section_id=product-recommendations
 */
import express from 'express';
import { getProductRecommendations } from '../services/shopify.js';
import { sendSections } from '../lib/sections.js';

const router = express.Router();

router.get('/products', async (req, res, next) => {
  try {
    const rawId = String(req.query.product_id || '');
    if (!/^\d+$/.test(rawId)) {
      return res.status(400).send('');
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 10);
    let products = [];
    try {
      products = await getProductRecommendations(`gid://shopify/Product/${rawId}`, limit);
    } catch {
      // Recommendations are an enhancement; render the empty section.
    }

    const handled = await sendSections(req, res, ['product-recommendations'], { products });
    if (!handled) res.status(400).send('');
  } catch (error) {
    next(error);
  }
});

export default router;
