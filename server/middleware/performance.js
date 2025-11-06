/**
 * Performance middleware
 * Sets appropriate cache headers for different resource types
 */
export function performanceMiddleware(req, res, next) {
  const url = req.url;
  
  // Static assets: cache 1 year (immutable)
  if (url.match(/\.(css|js|jpg|jpeg|png|webp|woff2|woff|ttf|svg)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // HTML pages: cache 5 min, stale-while-revalidate
  else if (url.match(/\.html$/) || url === '/' || !url.includes('.')) {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  }
  // API endpoints: no cache
  else if (url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  // Add Vary header for HTMX requests
  res.setHeader('Vary', 'HX-Request, Accept');
  
  next();
}

export default performanceMiddleware;
