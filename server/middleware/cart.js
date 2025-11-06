/**
 * Cart middleware
 * Manages cart ID in session, handles localStorage backup pattern
 */
export function cartMiddleware(req, res, next) {
  // Initialize cart ID in session if doesn't exist
  if (!req.session.cartId) {
    req.session.cartId = null;
  }
  
  // Check for cartId restore from localStorage (sent via request)
  if (req.headers['x-cart-id'] && !req.session.cartId) {
    req.session.cartId = req.headers['x-cart-id'];
  }
  
  // Make cart ID available in locals
  res.locals.cartId = req.session.cartId;
  req.cartId = req.session.cartId;
  
  // Helper to set cart ID in session
  req.setCartId = function(cartId) {
    req.session.cartId = cartId;
    req.cartId = cartId;
    res.locals.cartId = cartId;
  };
  
  next();
}

export default cartMiddleware;
