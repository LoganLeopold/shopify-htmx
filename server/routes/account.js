import express from 'express';
import { 
  customerAccessTokenCreate, 
  customerCreate, 
  getCustomer, 
  getCustomerOrders 
} from '../services/shopify.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Login page
router.get('/login', (req, res) => {
  if (req.session.customerAccessToken) {
    return res.redirect('/account');
  }
  
  res.render('pages/account/login', {
    layout: 'layouts/base',
    title: 'Login',
  });
});

// Login POST
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.render('pages/account/login', {
        error: 'Email and password are required',
        layout: 'layouts/base',
        title: 'Login',
      });
    }
    
    const result = await customerAccessTokenCreate(email, password);
    
    if (result.error) {
      return res.render('pages/account/login', {
        error: result.error,
        layout: 'layouts/base',
        title: 'Login',
      });
    }
    
    // Store access token in session
    req.session.customerAccessToken = result.token.accessToken;
    
    if (res.locals.isHTMX) {
      return res.hxRedirect('/account');
    }
    
    res.redirect('/account');
  } catch (error) {
    next(error);
  }
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.customerAccessToken) {
    return res.redirect('/account');
  }
  
  res.render('pages/account/register', {
    layout: 'layouts/base',
    title: 'Register',
  });
});

// Register POST
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.render('pages/account/register', {
        error: 'All fields are required',
        layout: 'layouts/base',
        title: 'Register',
      });
    }
    
    const result = await customerCreate(email, password, firstName, lastName);
    
    if (result.error) {
      return res.render('pages/account/register', {
        error: result.error,
        layout: 'layouts/base',
        title: 'Register',
      });
    }
    
    // Auto-login after registration
    const loginResult = await customerAccessTokenCreate(email, password);
    if (loginResult.token) {
      req.session.customerAccessToken = loginResult.token.accessToken;
    }
    
    if (res.locals.isHTMX) {
      return res.hxRedirect('/account');
    }
    
    res.redirect('/account');
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    
    if (res.locals.isHTMX) {
      return res.hxRedirect('/');
    }
    
    res.redirect('/');
  });
});

// Dashboard (requires auth)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const customer = await getCustomer(req.customerAccessToken);
    
    if (!customer) {
      req.session.destroy();
      return res.redirect('/account/login');
    }
    
    if (res.locals.isHTMX) {
      return res.render('pages/account/dashboard', {
        customer,
        layout: false,
      });
    }
    
    res.render('pages/account/dashboard', {
      customer,
      layout: 'layouts/base',
      title: 'Account',
    });
  } catch (error) {
    next(error);
  }
});

// Orders (requires auth)
router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const orders = await getCustomerOrders(req.customerAccessToken);
    
    if (res.locals.isHTMX) {
      return res.render('pages/account/orders', {
        orders,
        layout: false,
      });
    }
    
    res.render('pages/account/orders', {
      orders,
      layout: 'layouts/base',
      title: 'Orders',
    });
  } catch (error) {
    next(error);
  }
});

// Addresses (requires auth) - placeholder
router.get('/addresses', requireAuth, (req, res) => {
  res.render('pages/account/addresses', {
    layout: 'layouts/base',
    title: 'Addresses',
  });
});

export default router;
