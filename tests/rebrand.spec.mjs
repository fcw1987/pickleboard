import { expect, test } from '@playwright/test';

test('publishes Pickleball Park metadata and visible identity', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Pickleball Park - Pickleball Court Planner');

  const manifest = await page.evaluate(async () => (await fetch('manifest.json')).json());
  expect(manifest).toMatchObject({
    name: 'Pickleball Park',
    short_name: 'Pickleball Park',
    start_url: './index.html'
  });
  expect(manifest).not.toHaveProperty('id');

  const visibleText = await page.locator('body').innerText();
  expect(visibleText).toContain('Pickleball Park');
  expect(visibleText).not.toMatch(/\bPickleboard\b/);
});

test('keeps the legacy theme and public API compatible across the rebrand', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pickleboard-theme', 'dark'));
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.pickleboard));

  const before = await page.evaluate(() => window.pickleboard.captureBoardState());
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('pickleboard-theme'))).toBe('dark');
  expect(await page.evaluate(() => typeof window.PickleboardProjection?.courtToView)).toBe('function');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.pickleboard));
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.pickleboard.captureBoardState())).toEqual(before);
});

for (const width of [320, 390, 768]) {
  test(`full brand remains readable at 200% text size in ${width}px viewport`, async ({ page }) => {
    if (process.env.REBRAND_OLD_CSS) {
      const { execFileSync } = await import('node:child_process');
      const oldCSS = execFileSync('git', ['show', '98bf4c5:styles.css'], { encoding: 'utf8' });
      await page.route('**/styles.css', route => route.fulfill({ contentType: 'text/css', body: oldCSS }));
    }
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const brand = page.locator('.world-label strong');
    await expect(brand).toHaveText('Pickleball Park');
    const rects = await brand.evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
    });
    for (const rect of rects) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(844);
    }
    if (width <= 420) {
      const labelBox = await page.locator('.world-label').boundingBox();
      const courtBox = await page.locator('.court-container-fullscreen').boundingBox();
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(courtBox.y);
    }
    const menu = await page.locator('#menuToggle').boundingBox();
    expect(rects[0].left).toBeGreaterThan(menu.x + menu.width);
    await page.locator('#menuToggle').click();
    const heading = page.locator('.menu-header h2');
    await expect(heading).toHaveText('Pickleball Park');
    const headingBox = await heading.boundingBox();
    expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(width);
  });
}
