import { expect, test } from '@playwright/test';

async function openViewer(page) {
  await page.goto('/index.html?workspace=planner&second-render=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(() => window.pickleboard.plays.load('fifth-shot-drop'));
  await page.locator('#play3dView').click();
  await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);
}

test('3D renderer uses antialiasing and native DPR up to the quality cap', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await openViewer(page);
  const render = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const canvas = viewer.renderer.domElement;
    return {
      antialias: viewer.renderer.getContext().getContextAttributes().antialias,
      css: [canvas.clientWidth, canvas.clientHeight],
      buffer: [canvas.width, canvas.height],
      ratio: viewer.renderer.getPixelRatio(),
      pixelScale: viewer.getState().pixelScale
    };
  });
  expect(render.antialias).toBe(true);
  expect(render.pixelScale).toBe(1);
  expect(render.ratio).toBe(2);
  expect(render.buffer[0]).toBe(render.css[0] * 2);
  expect(render.buffer[1]).toBe(render.css[1] * 2);
  await context.close();
});

// The former mesh anatomy/material checks described the rejected toy model.
// This contract instead proves the shipped pixel layers, sampling, and identity.
test('pixel athletes use complete independent layers with team and handedness metadata', async ({ page }) => {
  await openViewer(page);
  const players = await page.evaluate(() => [...window.pickleboard.threeD.playerObjects.values()].map(root => {
    return {
      team: root.userData.team,
      handedness: root.userData.handedness,
      pixelActor: root.userData.pixelActor,
      bodyTexture: root.userData.body.material.map.image.src,
      actionTexture: root.userData.arm.material.map.image.src,
      distinctMaps: root.userData.body.material.map !== root.userData.arm.material.map,
      bodyVisible: root.userData.body.visible,
      actionVisible: root.userData.arm.visible,
      alphaTest: root.userData.body.material.alphaTest,
      groundY: root.userData.groundY,
      worldY: root.position.y
    };
  }));
  expect(players).toHaveLength(4);
  for (const player of players) {
    expect(player).toMatchObject({ pixelActor: true, distinctMaps: true, bodyVisible: true, actionVisible: true, alphaTest: 0.25, groundY: 0, worldY: 0 });
    expect(player.bodyTexture).toContain(`${player.team === 'team1' ? 'green' : 'orange'}-${player.handedness}`);
    expect(player.bodyTexture).toContain('-body.png');
    expect(player.actionTexture).toContain('-action.png');
  }
});

test('stroke sprites remain upright, continuously positioned, grounded, and contact calibrated', async ({ page }) => {
  await openViewer(page);
  const audit = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    return viewer.timeline.segments.filter(segment => segment.shotSemantics).map(segment => {
      const actor = viewer.playerObjects.get(segment.shotSemantics.playerId);
      const samples = [];
      for (let offset = -0.12; offset <= 0.1201; offset += 0.02) {
        viewer.applyAtTime(segment.startTime + segment.contactTime + offset);
        samples.push({
          position: actor.position.toArray(),
          paddle: actor.userData.paddleFaceWorld.toArray(),
          ball: viewer.ballObject.position.toArray(),
          frame: actor.userData.animation.frame,
          groundY: actor.position.y,
          visualPitch: actor.userData.visual.rotation.x
        });
      }
      return { samples };
    });
  });
  for (const shot of audit) {
    expect(shot.samples.every(sample => sample.groundY === 0 && Math.abs(sample.visualPitch) < 0.001)).toBe(true);
    expect(new Set(shot.samples.map(sample => sample.frame)).size).toBeGreaterThan(1);
    for (let i = 1; i < shot.samples.length; i++) {
      expect(Math.hypot(...shot.samples[i].position.map((value, axis) => value - shot.samples[i - 1].position[axis]))).toBeLessThan(0.4);
    }
    const atContact = shot.samples[6];
    expect(Math.hypot(...atContact.ball.map((value, axis) => value - atContact.paddle[axis]))).toBeLessThan(0.01);
  }
});

test('tab visibility gaps preserve elapsed time and the playing state', async ({ page }) => {
  await openViewer(page);
  const active = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    viewer.clock.elapsed = 0.4;
    viewer.clock.play(1000);
    viewer.clock.update(1100);
    document.dispatchEvent(new Event('visibilitychange'));
    const elapsedBeforeReturn = viewer.clock.elapsed;
    const elapsedAfterReturn = viewer.clock.update(100000);
    return { elapsedBeforeReturn, elapsedAfterReturn, playing: viewer.clock.playing };
  });
  expect(active.playing).toBe(true);
  expect(active.elapsedAfterReturn).toBe(active.elapsedBeforeReturn);

  const paused = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    viewer.clock.pause();
    document.dispatchEvent(new Event('visibilitychange'));
    const before = viewer.clock.elapsed;
    return { playing: viewer.clock.playing, before, after: viewer.clock.update(200000) };
  });
  expect(paused.playing).toBe(false);
  expect(paused.after).toBe(paused.before);
});
