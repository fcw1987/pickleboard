import { expect, test } from '@playwright/test';

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/index.html?three-d-e2e=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  return errors;
}

async function openDrop3d(page) {
  await page.evaluate(() => window.pickleboard.plays.load('third-shot-drop'));
  await page.locator('#play3dView').click();
  await expect(page.locator('#threeDViewer')).toBeVisible();
  await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);
}

test('3D View initializes regulation scene with players, ball, and handed paddles', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => window.pickleboard.tokens.player2.handedness = 'left');
  await openDrop3d(page);
  const scene = await page.evaluate(() => ({
    state: window.pickleboard.threeD.getState(),
    paddles: Object.fromEntries([...window.pickleboard.threeD.playerObjects]
      .map(([id, object]) => [id, { handedness: object.userData.handedness, side: object.userData.paddle.userData.side, x: object.userData.paddle.position.x }]))
  }));
  expect(scene.state).toMatchObject({ active: true, playerCount: 4, hasBall: true, playId: 'third-shot-drop' });
  expect(scene.paddles.player1).toMatchObject({ handedness: 'right', side: 'right' });
  expect(scene.paddles.player2).toMatchObject({ handedness: 'left', side: 'left' });
  expect(errors).toEqual([]);
});

test('named cameras switch without resetting the Play', async ({ page }) => {
  await openApp(page);
  await openDrop3d(page);
  for (const camera of ['overhead', 'sideline', 'behind-green', 'behind-orange']) {
    await page.locator('#threeDCamera').selectOption(camera);
    expect(await page.evaluate(() => window.pickleboard.threeD.getState().camera)).toBe(camera);
    expect(await page.evaluate(() => window.pickleboard.threeD.getState().elapsed)).toBe(0);
  }
});

test('play, pause, playback rate, restart, and proof bounce share one clock', async ({ page }) => {
  await openApp(page);
  await openDrop3d(page);
  await page.locator('#threeDRate').selectOption('0.25');
  await page.locator('#threeDPlayPause').click();
  await page.waitForTimeout(300);
  const slowElapsed = await page.evaluate(() => window.pickleboard.threeD.getState().elapsed);
  expect(slowElapsed).toBeGreaterThan(0);
  expect(slowElapsed).toBeLessThan(0.2);
  await page.locator('#threeDPlayPause').click();
  const paused = await page.evaluate(() => window.pickleboard.threeD.getState().elapsed);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.pickleboard.threeD.getState().elapsed)).toBeCloseTo(paused, 4);

  await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const proof = viewer.timeline.segments.find(segment => segment.step.id === 'third-drop');
    viewer.clock.elapsed = proof.endTime - proof.trajectory.bounceDuration / 2;
    viewer.applyAtTime(viewer.clock.elapsed);
  });
  const proof = await page.evaluate(() => window.pickleboard.threeD.getState().lastState);
  expect(proof.bounced).toBe(true);
  expect(proof.phase).toBe('bounce');
  await page.locator('#threeDRestart').click();
  expect(await page.evaluate(() => window.pickleboard.threeD.getState())).toMatchObject({ elapsed: 0, playing: false });
});

test('exit stops render loop, re-entry creates one new loop, and 2D Play remains intact', async ({ page }) => {
  await openApp(page);
  await openDrop3d(page);
  const firstLoopCount = await page.evaluate(() => window.pickleboard.threeD.getState().renderLoopCount);
  await page.locator('#threeDExit').click();
  await expect(page.locator('#threeDViewer')).toBeHidden();
  expect(await page.evaluate(() => window.pickleboard.threeD.getState().active)).toBe(false);
  expect(await page.evaluate(() => window.pickleboard.plays.getState().playId)).toBe('third-shot-drop');
  await page.locator('#playNext').click();
  expect(await page.evaluate(() => window.pickleboard.plays.getState().stepIndex)).toBe(1);
  await page.locator('#play3dView').click();
  await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.pickleboard.threeD.getState().renderLoopCount)).toBe(firstLoopCount + 1);
});

test('3D viewer fits portrait, landscape, and desktop controls', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await openApp(page);
    await openDrop3d(page);
    const layout = await page.evaluate(() => {
      const root = document.querySelector('#threeDViewer').getBoundingClientRect();
      const hud = document.querySelector('.three-d-hud').getBoundingClientRect();
      return { root: root.toJSON(), hud: hud.toJSON(), documentHeight: document.documentElement.scrollHeight };
    });
    expect(layout.root.width).toBeCloseTo(viewport.width, 0);
    expect(layout.root.height).toBeCloseTo(viewport.height, 0);
    expect(layout.hud.left).toBeGreaterThanOrEqual(0);
    expect(layout.hud.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(layout.hud.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(layout.documentHeight).toBeLessThanOrEqual(viewport.height + 1);
    await page.locator('#threeDExit').click();
  }
});

test('reduced motion retains 3D endpoints and camera controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await openDrop3d(page);
  await page.locator('#threeDCamera').selectOption('sideline');
  expect(await page.evaluate(() => window.pickleboard.threeD.getState().camera)).toBe('sideline');
  await page.locator('#threeDRestart').click();
  expect(await page.evaluate(() => window.pickleboard.threeD.getState().lastState.phase)).toBe('ready');
});

test('offline repeat visit can open the locally cached Three.js viewer', async ({ page, context }) => {
  await openApp(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await openDrop3d(page);
  expect(await page.evaluate(() => window.pickleboard.threeD.getState())).toMatchObject({ active: true, hasBall: true, playerCount: 4 });
  await context.setOffline(false);
});
