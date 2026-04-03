/**
 * Copy vendor dependencies from node_modules to dist/renderer/vendor/
 * for offline support (replaces CDN loading).
 */
import { cpSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dest = resolve(root, 'src', 'renderer', 'vendor');

const copies = [
  // xterm core
  {
    src: 'node_modules/@xterm/xterm/css/xterm.css',
    dst: 'xterm/xterm.css',
  },
  {
    src: 'node_modules/@xterm/xterm/lib/xterm.js',
    dst: 'xterm/xterm.js',
  },
  // xterm addons
  {
    src: 'node_modules/@xterm/addon-fit/lib/addon-fit.js',
    dst: 'xterm/addon-fit.js',
  },
  {
    src: 'node_modules/@xterm/addon-webgl/lib/addon-webgl.js',
    dst: 'xterm/addon-webgl.js',
  },
  {
    src: 'node_modules/@xterm/addon-search/lib/addon-search.js',
    dst: 'xterm/addon-search.js',
  },
  {
    src: 'node_modules/@xterm/addon-web-links/lib/addon-web-links.js',
    dst: 'xterm/addon-web-links.js',
  },
  // dockview-core
  {
    src: 'node_modules/dockview-core/dist/styles/dockview.css',
    dst: 'dockview/dockview.css',
  },
  {
    src: 'node_modules/dockview-core/dist/dockview-core.min.js',
    dst: 'dockview/dockview-core.min.js',
  },
  // morphdom
  {
    src: 'node_modules/morphdom/dist/morphdom-umd.min.js',
    dst: 'morphdom/morphdom.min.js',
  },
];

for (const { src, dst } of copies) {
  const srcPath = resolve(root, src);
  const dstPath = resolve(dest, dst);
  mkdirSync(dirname(dstPath), { recursive: true });
  cpSync(srcPath, dstPath);
}

console.log(`Copied ${copies.length} vendor files to dist/renderer/vendor/`);
