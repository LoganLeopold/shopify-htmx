/**
 * Layout rendering middleware
 *
 * EJS has no built-in layout support, so the `layout` option that routes pass
 * to `res.render()` was silently ignored and full page loads returned a bare
 * page fragment with no <head>, header, footer or scripts.
 *
 * This wraps `res.render()` so that `layout: 'layouts/base'` renders the view
 * first, then renders the layout with the result available as `body`.
 *
 * HTMX requests (including hx-boost navigations) only want the fragment that
 * gets swapped into #main-content, so the layout is skipped for them. (The
 * htmx middleware already treats history-restore requests as full page loads.)
 */
export function renderLayoutMiddleware(req, res, next) {
  const render = res.render.bind(res);

  res.render = function renderWithLayout(view, options = {}, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const { layout, ...locals } = options;

    if (!layout || res.locals.isHTMX) {
      return render(view, locals, callback);
    }

    render(view, locals, (err, body) => {
      if (err) return callback ? callback(err) : next(err);
      render(layout, { ...locals, body }, callback);
    });
  };

  next();
}

export default renderLayoutMiddleware;
