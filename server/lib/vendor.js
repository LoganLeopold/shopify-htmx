/**
 * Browser ES modules served straight from node_modules.
 *
 * Each package is mounted under a versioned path (/vendor/<name>@<version>/)
 * so it can be cached as immutable, and exposed to the browser through an
 * import map (see views/layouts/base.ejs), so components can write
 * `import { splitText } from 'griffo'` with no bundler.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Locates an installed package's root directory. Uses import resolution
 * because some packages (griffo included) export neither `./package.json`
 * nor a `require` condition.
 */
function packageRoot(name) {
  let dir = path.dirname(fileURLToPath(import.meta.resolve(name)));
  while (dir !== path.dirname(dir)) {
    const pkgJson = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJson) && JSON.parse(fs.readFileSync(pkgJson, 'utf8')).name === name) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Could not locate package root for ${name}`);
}

const PACKAGES = [
  // name, directory inside the package, entry file
  { name: 'griffo', dir: 'dist', entry: 'index.js' },
];

const mounts = PACKAGES.map(({ name, dir, entry }) => {
  const root = packageRoot(name);
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const urlBase = `/vendor/${name}@${version}/`;
  return {
    name,
    urlBase,
    url: urlBase + entry,
    fsDir: path.join(root, dir),
  };
});

/** Import map JSON for the <script type="importmap"> in the layout. */
export const importMap = JSON.stringify({
  imports: Object.fromEntries(mounts.map(m => [m.name, m.url])),
});

/** Preload hints so module dependencies download in parallel with the HTML. */
export const modulePreloads = mounts.map(m => m.url);

export function vendorRouter() {
  const router = express.Router();
  for (const m of mounts) {
    router.use(m.urlBase, express.static(m.fsDir, {
      maxAge: '1y',
      immutable: true,
      fallthrough: false,
    }));
  }
  return router;
}
