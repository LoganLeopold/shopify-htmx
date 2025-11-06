/**
 * Layout middleware
 * Loads shared layout data (cart summary, site config, navigation)
 */
import { getSiteConfig } from '../services/siteConfig.js';
import { getCart } from '../services/shopify.js';

export async function layoutMiddleware(req, res, next) {
  try {
    // Load site config (cached in service)
    const siteConfig = await getSiteConfig();
    res.locals.siteConfig = siteConfig;
    
    // Load cart summary if cart ID exists
    if (req.cartId) {
      try {
        const cart = await getCart(req.cartId);
        res.locals.cart = cart;
        res.locals.cartItemCount = cart?.totalQuantity || 0;
      } catch (error) {
        // Cart may have expired, clear it
        req.setCartId(null);
        res.locals.cart = null;
        res.locals.cartItemCount = 0;
      }
    } else {
      res.locals.cart = null;
      res.locals.cartItemCount = 0;
    }
    
    // Navigation structure (can be loaded from metafields or hardcoded)
    res.locals.navigation = [
      { name: 'Home', href: '/' },
      { name: 'Collections', href: '/collections' },
    ];
    
    next();
  } catch (error) {
    console.error('Layout middleware error:', error);
    // Continue even if layout data fails to load
    res.locals.siteConfig = { name: 'Shop' };
    res.locals.cart = null;
    res.locals.cartItemCount = 0;
    res.locals.navigation = [];
    next();
  }
}

export default layoutMiddleware;
