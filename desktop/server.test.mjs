import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { startDesktopServer } from './server.mjs';

test('Desktop serves only UI/runtime, refuses document upload and private paths', async () => {
  const server = startDesktopServer(0); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(base + '/healthz')).json()).app, 'hwpx-desktop-plugin');
    assert.equal((await (await fetch(base + '/healthz')).json()).file_ingress, 'browser-file');
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /HWPX · Live/);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await fetch(base + '/desktop/node_modules/@rhwp/editor/index.js')).status, 200);
    assert.equal((await fetch(base + '/desktop/node_modules/@rhwp/editor/package.json')).status, 404);
    const studio = await fetch(base + '/studio/');
    assert.equal(studio.status, 200);
    assert.match(studio.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.equal((await fetch(base + '/studio/fonts/D2Coding-Regular.woff2')).status, 200);
    assert.equal((await fetch(base + '/studio/src/main.ts')).status, 404);
    assert.equal((await fetch(base + '/studio/__file')).status, 404);
    assert.equal((await fetch(base + '/studio/../.runtime/rhwp/package.json')).status, 404);
    for (const path of ['/README.md', '/.env', '/.git/config', '/desktop/server.mjs', '/experiments/web-wasm/results/original.hwpx', '/C:/Users/me/file.hwpx', '/experiments/web-wasm/node_modules/@zip.js/zip.js/../../package.json']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base + '/upload', { method: 'POST', body: 'document' })).status, 405);
    assert.equal((await fetch(base + '/studio/rhwp_bg.wasm')).status, 200);
    assert.equal((await fetch(base + '/experiments/web-wasm/node_modules/@rhwp/core/rhwp_bg.wasm')).status, 404);
    const status = await new Promise(resolve => {
      request(base, { headers: { Host: 'untrusted.example' } }, res => { res.resume(); resolve(res.statusCode); }).end();
    });
    assert.equal(status, 403);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
