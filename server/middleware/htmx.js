/**
 * HTMX middleware
 * Detects HTMX requests and sets helpful locals
 */
export function htmxMiddleware(req, res, next) {
  const isHTMX = req.headers['hx-request'] === 'true';
  const isBoosted = req.headers['hx-boosted'] === 'true';
  const currentUrl = req.headers['hx-current-url'] || req.url;
  const target = req.headers['hx-target'];
  const trigger = req.headers['hx-trigger'];
  
  res.locals.isHTMX = isHTMX;
  res.locals.isBoosted = isBoosted;
  res.locals.hxTarget = target;
  res.locals.hxTrigger = trigger;
  res.locals.currentUrl = currentUrl;
  
  // Helper to set HTMX response headers
  res.setHTMXHeaders = function(headers) {
    Object.keys(headers).forEach(key => {
      res.setHeader(`HX-${key.replace(/([A-Z])/g, '-$1').toUpperCase()}`, headers[key]);
    });
  };
  
  // Helper to redirect via HTMX
  res.hxRedirect = function(url) {
    res.setHeader('HX-Redirect', url);
    res.sendStatus(200);
  };
  
  next();
}

export default htmxMiddleware;
