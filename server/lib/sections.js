/**
 * Section Rendering API (Shopify-style)
 *
 * Shopify themes re-render parts of a page by requesting the same URL with:
 *   ?section_id=<id>     -> that one section's HTML
 *   ?sections=<a>,<b>    -> JSON { "<a>": "<html>", "<b>": "<html>" }
 * Each section renders in the context of the URL's resource (here, the
 * product), wrapped in <div id="shopify-section-<id>" class="shopify-section">.
 * Horizon's variant picker, featured product and product recommendations are
 * all built on this.
 *
 * Sections are EJS templates in views/sections/<id>.ejs. Each route declares
 * which sections it can render. Anything else gets a 404, so arbitrary
 * templates can't be requested.
 */
const MAX_SECTIONS = 5; // Shopify's limit for ?sections=

export function sectionWrapperId(sectionId) {
  return `shopify-section-${sectionId}`;
}

function renderToString(req, res, view, locals) {
  return new Promise((resolve, reject) => {
    // app.render doesn't see res.locals, so merge them like res.render does.
    req.app.render(view, { ...res.app.locals, ...res.locals, ...locals }, (err, html) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
}

export async function renderSection(req, res, sectionId, locals) {
  const html = await renderToString(req, res, `sections/${sectionId}`, { ...locals, sectionId });
  return `<div id="${sectionWrapperId(sectionId)}" class="shopify-section">${html}</div>`;
}

/**
 * Which sections did this request ask for? Returns null for a normal page
 * request.
 */
export function requestedSections(req) {
  if (typeof req.query.section_id === 'string' && req.query.section_id) {
    return { mode: 'single', ids: [req.query.section_id] };
  }
  if (typeof req.query.sections === 'string' && req.query.sections) {
    const ids = [...new Set(req.query.sections.split(',').map(s => s.trim()).filter(Boolean))];
    return { mode: 'json', ids: ids.slice(0, MAX_SECTIONS) };
  }
  return null;
}

/**
 * Responds with the requested section(s) if this is a section rendering
 * request. Returns true when it handled the response.
 *
 * @param {string[]} allowed  section ids this route can render
 * @param {object|function} locals  template data, or a function returning it
 *   (receives the section id, for per-section data)
 */
export async function sendSections(req, res, allowed, locals) {
  const request = requestedSections(req);
  if (!request) return false;

  const unknown = request.ids.filter(id => !allowed.includes(id));
  if (unknown.length) {
    res.status(404);
    if (request.mode === 'json') res.json(Object.fromEntries(unknown.map(id => [id, null])));
    else res.send('');
    return true;
  }

  const dataFor = (id) => (typeof locals === 'function' ? locals(id) : locals);
  const rendered = await Promise.all(request.ids.map(id => renderSection(req, res, id, dataFor(id))));

  // Section responses vary by query string, not by HX-Request. Keep them out of
  // shared caches, since price and availability change.
  res.set('Cache-Control', 'private, no-cache');

  if (request.mode === 'json') {
    res.json(Object.fromEntries(request.ids.map((id, i) => [id, rendered[i]])));
  } else {
    res.type('html').send(rendered[0]);
  }
  return true;
}
