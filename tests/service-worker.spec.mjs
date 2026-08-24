import { expect, test } from '@playwright/test';

async function waitForWorker(page) {
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
}

async function unregisterWorkers(page) {
  await page.goto('/tests/fixtures/cache-setup.html');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  });
}

test.describe('service worker lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await unregisterWorkers(page);
  });

  test('installs the versioned shell and serves a repeat visit offline', async ({ page, context }) => {
    await page.goto('/index.html?install=1');
    await waitForWorker(page);

    const cacheState = await page.evaluate(async () => ({
      names: await caches.keys(),
      hasShell: Boolean(await caches.match('./index.html')),
      hasScript: Boolean(await caches.match('./script.js'))
    }));
    expect(cacheState.names).toContain('pickleboard-static-v2');
    expect(cacheState.hasShell).toBe(true);
    expect(cacheState.hasScript).toBe(true);

    await context.setOffline(true);
    await page.goto('/index.html?offline=1');
    await expect(page).toHaveTitle('Pickleboard - Pickleball Court Planner');
    await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard))).toBe(true);
    await context.setOffline(false);
  });

  test('upgrades old Pickleboard caches without deleting unrelated origin caches', async ({ page }) => {
    await page.goto('/tests/fixtures/cache-setup.html');
    await page.evaluate(() => window.seedCaches());
    expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([
      'pickleboard-static-v1',
      'unrelated-application-cache'
    ]));

    await page.goto('/index.html?upgrade=1');
    await waitForWorker(page);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([
      'pickleboard-static-v2',
      'unrelated-application-cache'
    ]));
    expect(await page.evaluate(() => caches.keys())).not.toContain('pickleboard-static-v1');
    expect(await page.evaluate(async () => {
      const cache = await caches.open('unrelated-application-cache');
      return (await cache.match('/tests/fixtures/unrelated.txt'))?.text();
    })).toBe('keep me');
  });

  test('offline navigation falls back to the shell without caching unknown online pages as the shell', async ({ page, context }) => {
    await page.goto('/index.html?navigation-setup=1');
    await waitForWorker(page);

    await page.goto('/tests/fixtures/cache-setup.html?online=1');
    await expect(page).toHaveTitle('Cache setup');

    await context.setOffline(true);
    await page.goto('/unknown/offline-route');
    await expect(page).toHaveTitle('Pickleboard - Pickleball Court Planner');
    await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard))).toBe(true);
    await context.setOffline(false);
  });

  test('refreshes a stale cached application asset from the current release', async ({ page }) => {
    await page.goto('/index.html?freshness-setup=1');
    await waitForWorker(page);

    await page.evaluate(async () => {
      const cache = await caches.open('pickleboard-static-v2');
      await cache.put('./script.js', new Response('window.__STALE_PICKLEBOARD_ASSET__ = true;', {
        headers: { 'Content-Type': 'text/javascript' }
      }));
    });

    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard))).toBe(true);
    expect(await page.evaluate(() => window.__STALE_PICKLEBOARD_ASSET__)).toBeUndefined();

    const cachedScript = await page.evaluate(async () => (await caches.match('./script.js')).text());
    expect(cachedScript).toContain('class Pickleboard');
    expect(cachedScript).not.toContain('__STALE_PICKLEBOARD_ASSET__');
  });
});
