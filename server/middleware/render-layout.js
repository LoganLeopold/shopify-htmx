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
 * gets swapped into #main-content, so the layout is skipped for them and
 * routes don't need separate HTMX branches. A <title> is prepended to the
 * fragment so htmx updates document.title on navigation. (The htmx middleware
 * already treats history-restore requests as full page loads.)
 */
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export function renderLayoutMiddleware(req, res, next) {
  const render = res.render.bind(res);

  res.render = function renderWithLayout(view, options = {}, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const { layout, ...locals } = options;

    if (!layout) {
      return render(view, locals, callback);
    }

    if (res.locals.isHTMX) {
      if (!locals.title) return render(view, locals, callback);
      return render(view, locals, (err, html) => {
        if (err) return callback ? callback(err) : next(err);
        const fragment = `<title>${escapeHtml(locals.title)}</title>${html}`;
        return callback ? callback(null, fragment) : res.send(fragment);
      });
    }

    render(view, locals, (err, body) => {
      if (err) return callback ? callback(err) : next(err);
      render(layout, { ...locals, body }, callback);
    });
  };

  next();
}

export default renderLayoutMiddleware;
