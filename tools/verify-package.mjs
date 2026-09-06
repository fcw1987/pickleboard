// Validate the exact static artifact at the real Pages path, not a source checkout.
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium, webkit, expect } from '@playwright/test';
const sha = b => createHash('sha256').update(b).digest('hex');
mkdirSync('release-results', { recursive: true });
const artifact = resolve('dist');
const manifest = JSON.parse(readFileSync(`${artifact}/runtime-manifest.json`));
const info = JSON.parse(readFileSync(`${artifact}/build-info.json`));
expect(sha(readFileSync(`${artifact}/runtime-manifest.json`))).toBe(info.runtimeManifestSha256);
const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`, `${prefix}${e.name}/`) : `${prefix}${e.name}`);
expect(walk(artifact).sort()).toEqual([...manifest.files.map(f => f.path), ...info.publicationMetadata].sort());
for (const f of manifest.files) expect(sha(readFileSync(`${artifact}/${f.path}`)), f.path).toBe(f.sha256);
const prior = JSON.parse(readFileSync('tests/fixtures/prior-production.json'));
const oldFiles = new Map();
for (const f of prior.files) {
  const b = execFileSync('git', ['show', `${prior.revision}:${f.file}`], { maxBuffer: 20 * 1024 * 1024 });
  expect(sha(b), `verified previous public asset ${f.file}`).toBe(f.sha256); oldFiles.set(f.file, b);
}
const results = [];
const scopePath = new URL('https://fcw1987.github.io/pickleboard/').pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const mode of ['fresh', 'upgrade']) {
    let phase = mode === 'upgrade' ? 'old' : 'new', stopped = false;
    const server = createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (!pathname.startsWith(scopePath) || pathname.split('/').includes('..')) return res.writeHead(404).end('Not found');
      const file = pathname.slice(scopePath.length) || 'index.html';
      try {
        const bytes = phase === 'old' ? oldFiles.get(file) : readFileSync(`${artifact}/${file}`);
        if (!bytes) throw Error('Not cached in prior release');
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
      } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}${scopePath}`;
    const browser = await browserType.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(base);
      await page.waitForFunction(() => navigator.serviceWorker.controller && window.pickleboard?.plays);
      expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(base);
      const oldManifest = await page.evaluate(async () => (await fetch('./manifest.json')).json());
      if (mode === 'upgrade') {
        expect(await page.evaluate(() => caches.keys())).toContain('pickleboard-static-v8');
        await page.evaluate(async () => {
          localStorage.setItem('pickleboard-theme', 'dark');
          const unrelated = await caches.open('unrelated-application-cache'); await unrelated.put('/keep', new Response('preserve'));
          pickleboard.setTokenPosition('player1', 8.25, 12.75); pickleboard.setDrawingMode(true);
        });
        const before = await page.evaluate(() => pickleboard.captureBoardState());
        phase = 'new';
        await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
        await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 20000 }).toContain('pickleboard-static-v15');
        await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 20000 }).not.toContain('pickleboard-static-v8');
        expect(await page.evaluate(() => pickleboard.captureBoardState())).toEqual(before);
        await page.reload(); await page.waitForFunction(() => window.pickleboard?.plays);
        expect(await page.evaluate(() => ({ theme: localStorage.getItem('pickleboard-theme'), body: document.body.dataset.theme }))).toEqual({ theme: 'dark', body: 'dark' });
        expect(await page.evaluate(async () => (await (await caches.open('unrelated-application-cache')).match('/keep')).text())).toBe('preserve');
      }
      await expect(page).toHaveTitle('Pickleball Park - Pickleball Court Planner');
      const currentManifest = await page.evaluate(async () => (await fetch('./manifest.json')).json());
      expect(currentManifest.name).toBe('Pickleball Park');
      expect({ id: currentManifest.id, start_url: currentManifest.start_url }).toEqual({ id: oldManifest.id, start_url: oldManifest.start_url });
      const checks = await page.evaluate(async ({ files, scopePath }) => {
        const cache = await caches.open('pickleboard-static-v15');
        const digest = async r => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await r.arrayBuffer()))).map(v => v.toString(16).padStart(2, '0')).join('');
        const all = [];
        for (const f of files) {
          const r = await fetch(`./${f.path}`); if (!r.ok) throw Error(`HTTP ${r.status}: ${f.path}`);
          all.push({ path: f.path, sha256: await digest(r), type: r.headers.get('content-type') });
        }
        const cached = [];
        for (const request of await cache.keys()) {
          const path = new URL(request.url).pathname.slice(scopePath.length) || 'index.html';
          cached.push({ path, sha256: await digest(await cache.match(request)) });
        }
        return { all, cached };
      }, { files: manifest.files, scopePath });
      for (const f of checks.all) {
        expect(f.sha256, f.path).toBe(manifest.files.find(e => e.path === f.path).sha256);
        if (f.path.endsWith('.js')) expect(f.type).toContain('javascript');
        if (f.path.endsWith('.png')) expect(f.type).toBe('image/png');
      }
      for (const f of checks.cached) expect(f.sha256, `cached ${f.path}`).toBe(manifest.files.find(e => e.path === f.path)?.sha256);
      const declaredCachePaths = [...readFileSync(`${artifact}/sw.js`, 'utf8').split('const STATIC_ASSETS = [')[1].split('];')[0].matchAll(/'\.\/([^']*)'/g)].map(m => m[1] || 'index.html');
      expect(checks.cached.map(f => f.path).sort()).toEqual(declaredCachePaths.sort());
      const missing = await context.request.get(`${base}missing-asset.png`); expect(missing.status()).toBe(404);
      // Exercise actual pointer mapping, drawing, transport and snapshot restoration.
      const target = await page.locator('#player1-touch').boundingBox();
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2); await page.mouse.down(); await page.mouse.move(target.x + target.width / 2 + 20, target.y + target.height / 2 + 20, { steps: 4 }); await page.mouse.up();
      await page.evaluate(() => pickleboard.setDrawingMode(true));
      const court = await page.locator('#court').boundingBox();
      await page.mouse.move(court.x + court.width * .35, court.y + court.height * .35); await page.mouse.down(); await page.mouse.move(court.x + court.width * .4, court.y + court.height * .4, { steps: 4 }); await page.mouse.up();
      await expect(page.locator('#drawingLayer .drawing-stroke')).toHaveCount(1);
      const saved = await page.evaluate(() => pickleboard.captureBoardState());
      await page.evaluate(() => pickleboard.plays.load('serve-and-return'));
      await page.locator('#playPlayPause').click();
      await expect.poll(() => page.evaluate(() => pickleboard.plays.getState().elapsed)).toBeGreaterThan(0.1);
      await page.locator('#playPlayPause').click(); await page.locator('#playLoop').click();
      await page.locator('#play3dView').click(); await page.waitForFunction(() => pickleboard.threeD.active);
      await expect(page.locator('#threeDLoop')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#threeDCamera').selectOption('sideline'); await page.locator('#threeDRate').selectOption('0.5');
      await page.locator('#threeDExit').click(); await page.locator('#playExit').click();
      expect(await page.evaluate(() => pickleboard.captureBoardState())).toEqual(saved);
      await page.screenshot({ path: `release-results/package-${browserName}-${mode}.png` });
      // Real offline: close only this test's server. Do not use setOffline emulation.
      server.closeAllConnections(); await new Promise(r => server.close(r)); stopped = true;
      await page.reload(); await page.waitForFunction(() => window.pickleboard?.plays);
      await page.evaluate(() => pickleboard.setTokenPosition('player1', 9, 12));
      const offlineSaved = await page.evaluate(() => pickleboard.captureBoardState());
      const ids = await page.evaluate(() => pickleboard.plays.list().map(p => p.id)); expect(ids).toHaveLength(8);
      for (const id of ids) {
        await page.evaluate(id => pickleboard.plays.load(id), id);
        await page.locator('#play3dView').click(); await page.waitForFunction(() => pickleboard.threeD.active);
        await page.locator('#threeDExit').click(); await page.locator('#playExit').click();
        expect(await page.evaluate(() => pickleboard.captureBoardState())).toEqual(offlineSaved);
      }
      await expect(page.locator('#threeDCanvas canvas')).toHaveCount(0); expect(errors).toEqual([]);
      results.push({ browser: browserName, mode, status: 'PASS', runtimeHashes: checks.all.length, cacheEntries: checks.cached.length, offlineLessons: ids.length, offlineMethod: 'owned server stopped', source: info.revision, previousPublicSource: mode === 'upgrade' ? prior.revision : null });
    } catch (e) { results.push({ browser: browserName, mode, status: 'FAIL', error: e.message }); throw e; }
    finally { await browser.close(); if (!stopped) { server.closeAllConnections(); await new Promise(r => server.close(r)); } mkdirSync('release-results', { recursive: true }); writeFileSync('release-results/package-verification.json', JSON.stringify(results, null, 2)); }
  }
}
console.log(JSON.stringify(results, null, 2));
