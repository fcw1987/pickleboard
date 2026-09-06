import { webkit } from '@playwright/test';

const origin = process.env.PICKLEBOARD_TEST_URL || 'http://127.0.0.1:4173';
const browser = await webkit.launch();
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();

async function cacheEvidence(label) {
  return page.evaluate(async evidenceLabel => {
    const name = 'unrelated-application-cache';
    const cache = await caches.open(name);
    const requestUrl = new URL('/tests/fixtures/unrelated.txt', location.origin).href;
    const response = await cache.match(new Request(requestUrl));
    return {
      label: evidenceLabel,
      controller: navigator.serviceWorker.controller?.scriptURL || null,
      cacheNames: await caches.keys(),
      unrelatedRequestUrls: (await cache.keys()).map(request => request.url),
      exactRequestUrl: requestUrl,
      exactBody: response ? await response.text() : null
    };
  }, label);
}

try {
  await page.goto(`${origin}/tests/fixtures/cache-setup.html?webkit-diagnostic=1`);
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    await window.seedCaches();
  });
  const before = await cacheEvidence('immediately-after-seed');
  if (before.exactBody !== 'keep me') throw new Error(`WebKit cache seed failed: ${JSON.stringify(before)}`);

  await page.evaluate(() => caches.delete('pickleboard-static-v1'));
  const afterDirectDelete = await cacheEvidence('after-direct-old-cache-delete');
  await page.evaluate(async () => {
    const oldCache = await caches.open('pickleboard-static-v1');
    await oldCache.put('./index.html', new Response('<title>Old Pickleboard</title>'));
    const unrelated = await caches.open('unrelated-application-cache');
    await unrelated.put(new URL('./unrelated.txt', location.href).href, new Response('keep me'));
  });
  const beforeWorker = await cacheEvidence('after-reseed-before-worker');

  await page.goto(`${origin}/index.html?webkit-cache-diagnostic=1`);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
  await page.waitForFunction(async () => (await caches.keys()).some(name => name.startsWith('pickleboard-static-')));
  const after = await cacheEvidence('after-worker-activation');
  console.log(JSON.stringify({ browser: 'webkit', origin, before, afterDirectDelete, beforeWorker, after }, null, 2));
  if (after.exactBody !== 'keep me') process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
