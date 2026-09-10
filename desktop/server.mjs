import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = new Set([
  'desktop/studio.html', 'desktop/studio.mjs', 'desktop/studio.css', 'desktop/studio-tools.mjs',
  ...['index.js', 'transport.js', 'document-agent-contract.js'].map(name => 'desktop/node_modules/@rhwp/editor/' + name),
]);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' };
export function startDesktopServer(port = 4175) {
  return createServer(async (req, res) => {
    try {
      // Loopback binding plus Host validation blocks DNS-rebinding access to local assets.
      if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '')) { res.writeHead(403).end(); return; }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (url.pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ app: 'hwpx-desktop-plugin', protocol: 1, entry: '/desktop/', file_ingress: 'browser-file', uploads: false })); return;
      }
      if (url.pathname === '/') { res.writeHead(302, { Location: '/desktop/' }).end(); return; }
      const name = decodeURIComponent(url.pathname).slice(1).replace(/^desktop\/$/, 'desktop/studio.html').replace(/^studio\/$/, 'studio/index.html');
      const studioAsset = name.startsWith('studio/') && /^[A-Za-z0-9_./@ -]+\.(?:html|js|css|wasm|woff2?|ttf|otf|svg|png|ico|json|txt)$/.test(name.slice(7));
      if ((!assets.has(name) && !studioAsset) || name.includes('..') || name.includes('\\')) { res.writeHead(404).end(); return; }
      const target = await realpath(resolve(root, studioAsset ? 'desktop/.runtime/' + name : name));
      const allowedRoot = await realpath(studioAsset ? resolve(root, 'desktop/.runtime/studio') : root);
      if (!target.startsWith(allowedRoot + sep)) { res.writeHead(403).end(); return; }
      const body = await readFile(target);
      res.writeHead(200, {
        'Content-Type': mime[extname(name)] ?? 'application/octet-stream', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors " + (studioAsset ? "'self'" : "'none'"),
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  }).listen(port, '127.0.0.1');
}
