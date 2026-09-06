import { expect, test } from '@playwright/test';

async function open3d(page) {
  await page.goto('/index.html?three-d-visual=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(() => window.pickleboard.plays.load('third-shot-drop'));
  await page.locator('#play3dView').click();
  await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);
  await expect(page.locator('#threeDViewer')).toBeVisible();
}

// Supersedes the rejected volumetric rig-node assertion: acceptance follows
// the layers and authored anchors that are actually visible in the replay.
test('visible pixel actors expose independent body/action layers and physical handedness', async ({ page }) => {
  await page.goto('/index.html?three-d-visual-hands=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(() => { window.pickleboard.tokens.player2.handedness = 'left'; window.pickleboard.plays.load('third-shot-drop'); });
  await page.locator('#play3dView').click();
  await expect(page.locator('#threeDCanvas canvas')).toHaveCount(1);
  const players = await page.evaluate(() => Object.fromEntries([...window.pickleboard.threeD.playerObjects].map(([id, root]) => [id, {
    pixelActor: root.userData.pixelActor,
    body: root.userData.body.name,
    arm: root.userData.arm.name,
    distinctGeometry: root.userData.body.geometry !== root.userData.arm.geometry,
    distinctUvStorage: root.userData.body.geometry.attributes.uv.array !== root.userData.arm.geometry.attributes.uv.array,
    handedness: root.userData.handedness,
    frame: root.userData.animation.frame,
    team: root.userData.team,
    groundY: root.userData.groundY,
    worldY: root.position.y
  }])));
  for (const player of Object.values(players)) {
    expect(player).toMatchObject({ pixelActor: true, body: 'PixelBody', arm: 'PixelPaddleArm', distinctGeometry: true, distinctUvStorage: true, frame: 'ready' });
    expect(player.groundY).toBe(0);
    expect(player.worldY).toBe(0);
  }
  expect(players.player1).toMatchObject({ handedness: 'right', team: 'team1' });
  expect(players.player2).toMatchObject({ handedness: 'left', team: 'team1' });
  expect(players.player3.team).toBe('team2');
});

test('court, sagging net, surround, and camera framing preserve authoritative dimensions', async ({ page }) => {
  await open3d(page);
  const scene = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const cameraStates = {};
    for (const name of ['overhead', 'sideline', 'behind-green', 'behind-orange']) {
      viewer.setCamera(name);
      cameraStates[name] = { position: viewer.camera.position.toArray(), fov: viewer.camera.fov };
    }
    return {
      court: viewer.courtObject.userData,
      net: viewer.netObject.userData,
      hasSurround: Boolean(viewer.scene.getObjectByName('CourtSurround')),
      hasSlab: Boolean(viewer.scene.getObjectByName('CourtSlab')),
      hasKitchen: Boolean(viewer.scene.getObjectByName('KitchenSurface')),
      hasMesh: Boolean(viewer.scene.getObjectByName('NetMesh')),
      hasTape: Boolean(viewer.scene.getObjectByName('NetTopTape')),
      postCount: viewer.scene.getObjectsByProperty('name', 'NetPost').length,
      cameraStates
    };
  });
  expect(scene.court.width).toBeCloseTo(20 * 0.3048, 6);
  expect(scene.court.length).toBeCloseTo(44 * 0.3048, 6);
  expect(scene.net.sideHeight).toBeGreaterThan(scene.net.centerHeight);
  expect(scene).toMatchObject({ hasSurround: true, hasSlab: true, hasKitchen: true, hasMesh: true, hasTape: true, postCount: 2 });
  expect(scene.cameraStates.overhead.position[1]).toBeGreaterThan(10);
  expect(scene.cameraStates.overhead.position[0]).toBeGreaterThan(0);
  expect(scene.cameraStates.sideline.position[0]).toBeGreaterThan(8);
  expect(scene.cameraStates.sideline.position[1]).toBeGreaterThan(4);
  expect(scene.cameraStates['behind-green'].position[2]).toBeLessThan(0);
  expect(scene.cameraStates['behind-orange'].position[2]).toBeGreaterThan(0);
  expect(Object.values(scene.cameraStates).map(camera => camera.fov)).toEqual([46, 50, 52, 52]);
});

test('ball keeps its physical radius while enforcing a readable projected diameter', async ({ page }) => {
  await open3d(page);
  const ball = await page.evaluate(() => ({
    ...window.pickleboard.threeD.ballObject.userData,
    projectedDiameter: (() => {
      const viewer = window.pickleboard.threeD;
      const position = viewer.ballObject.position.clone().applyMatrix4(viewer.camera.matrixWorldInverse);
      const worldPerPixel = 2 * Math.max(0.01, -position.z) * Math.tan(viewer.camera.fov * Math.PI / 360)
        / viewer.elements.canvas.clientHeight;
      return viewer.readableBall.sprite.scale.x / worldPerPixel * 12 / 16;
    })()
  }));
  expect(ball.visualRadius).toBe(ball.physicalRadius);
  expect(ball.minimumCSSDiameter).toBeGreaterThanOrEqual(8);
  expect(ball.projectedDiameter).toBeGreaterThanOrEqual(ball.minimumCSSDiameter - 0.01);
});
