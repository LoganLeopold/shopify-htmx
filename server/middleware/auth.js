/**
 * Auth middleware
 * Validates customer access tokens and protects routes
 */
export function authMiddleware(req, res, next) {
  const accessToken = req.session.customerAccessToken;
  
  if (accessToken) {
    res.locals.customerAccessToken = accessToken;
    req.customerAccessToken = accessToken;
    res.locals.isAuthenticated = true;
  } else {
    res.locals.isAuthenticated = false;
  }
  
  next();
}

/**
 * Require authentication middleware
 * Redirects to login if not authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.session.customerAccessToken) {
    if (res.locals.isHTMX) {
      return res.hxRedirect('/account/login');
    }
    return res.redirect('/account/login');
  }
  next();
}

export default authMiddleware;
