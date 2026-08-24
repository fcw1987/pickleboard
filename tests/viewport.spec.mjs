import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile portrait', width: 390, height: 844 },
  { name: 'mobile landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 }
];

for (const viewport of viewports) {
  test(`court fits the usable ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/index.html?viewport=1');

    const layout = await page.evaluate(() => {
      const rect = document.querySelector('#court').getBoundingClientRect();
      const player = document.querySelector('#player1');
      const playerRect = player.getBoundingClientRect();
      const playerState = window.pickleboard.getTokenPositions().player1;
      const expectedCenter = {
        x: rect.left + ((playerState.x + 8) / 36) * rect.width,
        y: rect.top + ((playerState.y + 8) / 60) * rect.height
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        court: { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom },
        playerCenter: { x: playerRect.left + playerRect.width / 2, y: playerRect.top + playerRect.height / 2 },
        expectedCenter,
        documentHeight: document.documentElement.scrollHeight,
        ratio: rect.width / rect.height
      };
    });

    expect(layout.court.width).toBeGreaterThan(0);
    expect(layout.court.height).toBeGreaterThan(0);
    expect(layout.court.top).toBeGreaterThanOrEqual(0);
    expect(layout.court.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewport.height + 1);
    expect(layout.ratio).toBeCloseTo(36 / 60, 2);
    expect(layout.playerCenter.x).toBeCloseTo(layout.expectedCenter.x, 0);
    expect(layout.playerCenter.y).toBeCloseTo(layout.expectedCenter.y, 0);
  });
}
