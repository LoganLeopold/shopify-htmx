import express from 'express';
import { 
  createCart, 
  getCart, 
  addToCart, 
  updateCartLine, 
  removeFromCart 
} from '../services/shopify.js';

const router = express.Router();

// Full cart page
router.get('/', async (req, res, next) => {
  try {
    if (!req.cartId) {
      if (res.locals.isHTMX) {
        return res.render('partials/cart-empty', { layout: false });
      }
      return res.render('pages/cart', {
        cart: null,
        layout: 'layouts/base',
        title: 'Cart',
      });
    }
    
    const cart = await getCart(req.cartId);
    
    if (!cart) {
      req.setCartId(null);
      if (res.locals.isHTMX) {
        return res.render('partials/cart-empty', { layout: false });
      }
      return res.render('pages/cart', {
        cart: null,
        layout: 'layouts/base',
        title: 'Cart',
      });
    }
    
    res.render('pages/cart', {
      cart,
      layout: 'layouts/base',
      title: 'Cart',
    });
  } catch (error) {
    next(error);
  }
});

// Cart drawer content
router.get('/drawer', async (req, res, next) => {
  try {
    if (!req.cartId) {
      return res.render('partials/cart-drawer', {
        cart: null,
        layout: false,
      });
    }
    
    const cart = await getCart(req.cartId);
    res.render('partials/cart-drawer', {
      cart,
      layout: false,
    });
  } catch (error) {
    next(error);
  }
});

// Cart summary (header)
router.get('/summary', async (req, res, next) => {
  try {
    if (!req.cartId) {
      return res.render('partials/cart-summary', {
        cartItemCount: 0,
        layout: false,
      });
    }
    
    const cart = await getCart(req.cartId);
    res.render('partials/cart-summary', {
      cartItemCount: cart?.totalQuantity || 0,
      layout: false,
    });
  } catch (error) {
    next(error);
  }
});

// Add to cart
router.post('/add', async (req, res, next) => {
  try {
    const { variantId, quantity = 1 } = req.body;
    
    if (!variantId) {
      return res.status(400).send('<div class="error">Variant ID required</div>');
    }
    
    let cartId = req.cartId;
    
    // Create cart if doesn't exist
    if (!cartId) {
      const newCart = await createCart();
      cartId = newCart.id;
      req.setCartId(cartId);
    }
    
    // Add item
    const cart = await addToCart(cartId, variantId, parseInt(quantity, 10));
    
    // Update cart ID if changed
    if (cart.id !== cartId) {
      req.setCartId(cart.id);
    }
    
    // Trigger cart-updated event for other components
    res.setHeader('HX-Trigger', 'cart-updated');
    
    // Return drawer content
    res.render('partials/cart-drawer', {
      cart,
      layout: false,
    });
  } catch (error) {
    next(error);
  }
});

// Update cart line
router.post('/update', async (req, res, next) => {
  try {
    const { lineId, quantity } = req.body;
    
    if (!req.cartId || !lineId) {
      return res.status(400).send('<div class="error">Cart ID and line ID required</div>');
    }
    
    const qty = parseInt(quantity, 10);
    
    if (qty <= 0) {
      // Remove item if quantity is 0 or less
      const cart = await removeFromCart(req.cartId, lineId);
      req.setCartId(cart.id);
    } else {
      // Update quantity
      const cart = await updateCartLine(req.cartId, lineId, qty);
      req.setCartId(cart.id);
    }
    
    const cart = await getCart(req.cartId);
    
    // Trigger cart-updated event
    res.setHeader('HX-Trigger', 'cart-updated');
    
    // Return cart items
    res.render('partials/cart-items', {
      cart,
      layout: false,
    });
  } catch (error) {
    next(error);
  }
});

// Remove from cart
router.post('/remove', async (req, res, next) => {
  try {
    const { lineId } = req.body;
    
    if (!req.cartId || !lineId) {
      return res.status(400).send('<div class="error">Cart ID and line ID required</div>');
    }
    
    const cart = await removeFromCart(req.cartId, lineId);
    req.setCartId(cart.id);
    
    // Trigger cart-updated event
    res.setHeader('HX-Trigger', 'cart-updated');
    
    // Return cart items (or empty state)
    if (cart.totalQuantity === 0) {
      res.render('partials/cart-empty', { layout: false });
    } else {
      res.render('partials/cart-items', {
        cart,
        layout: false,
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
