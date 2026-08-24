import { expect, test } from '@playwright/test';

async function open3d(page) {
  await page.goto('/index.html?three-d-visual=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(() => window.pickleboard.plays.load('third-shot-drop'));
  await page.locator('#play3dView').click();
  await expect(page.locator('#threeDViewer')).toBeVisible();
}

test('procedural players expose animation-ready articulated hierarchy and handed paddle ownership', async ({ page }) => {
  await page.goto('/index.html?three-d-visual-hands=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(() => { window.pickleboard.tokens.player2.handedness = 'left'; window.pickleboard.plays.load('third-shot-drop'); });
  await page.locator('#play3dView').click();
  const players = await page.evaluate(() => Object.fromEntries([...window.pickleboard.threeD.playerObjects].map(([id, root]) => [id, {
    names: Object.keys(root.userData.nodes),
    paddleHand: root.userData.paddleHand,
    paddleParent: root.userData.paddle.parent?.name,
    team: root.userData.team,
    groundY: root.userData.groundY,
    worldY: root.position.y
  }])));
  const required = ['Hips', 'Torso', 'Head', 'CapCrown', 'CapBrim', 'LeftArm', 'LeftElbow', 'LeftHand',
    'RightArm', 'RightElbow', 'RightHand', 'LeftLeg', 'LeftKnee', 'LeftFoot', 'RightLeg', 'RightKnee', 'RightFoot',
    'PaddleAttachment', 'PaddleHandle', 'PaddleGrip', 'PaddleFace', 'PaddleTrim'];
  for (const player of Object.values(players)) {
    expect(player.names).toEqual(expect.arrayContaining(required));
    expect(player.groundY).toBe(0);
    expect(player.worldY).toBe(0);
  }
  expect(players.player1).toMatchObject({ paddleHand: 'RightHand', paddleParent: 'RightHand', team: 'team1' });
  expect(players.player2).toMatchObject({ paddleHand: 'LeftHand', paddleParent: 'LeftHand', team: 'team1' });
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
  expect(scene.cameraStates.overhead).toEqual({ position: [0, 11.8, 8.8], fov: 46 });
  expect(scene.cameraStates.sideline).toEqual({ position: [9.2, 2.15, 0], fov: 50 });
  expect(scene.cameraStates['behind-green']).toEqual({ position: [0, 1.95, -10.2], fov: 52 });
  expect(scene.cameraStates['behind-orange']).toEqual({ position: [0, 1.95, 10.2], fov: 52 });
});

test('ball has a modest readability scale while retaining physical trajectory radius', async ({ page }) => {
  await open3d(page);
  const ball = await page.evaluate(() => window.pickleboard.threeD.ballObject.userData);
  expect(ball.visualRadius).toBeGreaterThan(ball.physicalRadius);
  expect(ball.visualRadius / ball.physicalRadius).toBeCloseTo(1.16, 2);
});
