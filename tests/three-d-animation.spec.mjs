import { expect, test } from '@playwright/test';

async function openPlay(page, playId = 'fifth-shot-drop') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/index.html?animation-e2e=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(id => window.pickleboard.plays.load(id), playId);
  await page.locator('#play3dView').click();
  return errors;
}

async function sampleSegment(page, stepId, offset) {
  return page.evaluate(({ stepId, offset }) => {
    const viewer = window.pickleboard.threeD;
    const segment = viewer.timeline.segments.find(item => item.step.id === stepId);
    const time = segment.startTime + (offset === 'contact' ? segment.contactTime : offset);
    viewer.clock.pause();
    viewer.clock.elapsed = time;
    viewer.applyAtTime(time);
    const actor = viewer.playerObjects.get(segment.shotSemantics.playerId);
    return {
      segment: { startTime: segment.startTime, contactTime: segment.contactTime, endTime: segment.endTime, actor: segment.shotSemantics.playerId, stroke: segment.shotSemantics.stroke },
      animation: actor.userData.animation,
      ball: viewer.lastState,
      actorPosition: actor.position.toArray(),
      targetPosition: viewer.playerObjects.get(segment.shotSemantics.playerId).position.toArray()
    };
  }, { stepId, offset });
}

test('serve, return, drive, block, and fifth drop resolve actors and synchronize ball launch to contact', async ({ page }) => {
  const errors = await openPlay(page);
  const expected = [
    ['serve', 'player1', 'serve'],
    ['return', 'player3', 'forehand'],
    ['third-drive', 'player1', 'forehand'],
    ['fourth-block', 'player4', 'block'],
    ['fifth-drop', 'player1', 'drop']
  ];
  for (const [stepId, actor, stroke] of expected) {
    const before = await sampleSegment(page, stepId, Math.max(0.01, (await page.evaluate(id => {
      const s = window.pickleboard.threeD.timeline.segments.find(x => x.step.id === id); return s.contactTime - 0.02;
    }, stepId))));
    expect(before.segment).toMatchObject({ actor, stroke });
    expect(before.ball.phase).toBe('waiting-contact');
    expect(before.ball.launched).toBe(false);
    const at = await sampleSegment(page, stepId, 'contact');
    expect(at.ball.launched).toBe(true);
    expect(['contact', 'flight', 'landed']).toContain(at.ball.phase);
    expect(at.animation.stroke).toBe(stroke);
  }
  expect(errors).toEqual([]);
});

test('right and left handed forehands animate their dominant physical arm', async ({ page }) => {
  await page.goto('/index.html?animation-hands=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard?.threeD))).toBe(true);
  await page.evaluate(() => {
    window.pickleboard.tokens.player1.handedness = 'left';
    window.pickleboard.plays.load('third-shot-drive');
  });
  await page.locator('#play3dView').click();
  const result = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const segment = viewer.timeline.segments.find(item => item.step.id === 'third-drive');
    const time = segment.startTime + segment.contactTime;
    viewer.applyAtTime(time);
    const root = viewer.playerObjects.get('player1');
    return { dominant: root.userData.aliases.dominantArm, paddleParent: root.userData.paddle.parent.name, phase: root.userData.animation.phase };
  });
  expect(result).toMatchObject({ dominant: 'LeftArm', paddleParent: 'LeftHand', phase: 'contact' });
});

test('striker plants both world axes before contact and non-strikers use locomotion or split-step', async ({ page }) => {
  await openPlay(page, 'third-shot-drive');
  const state = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const segment = viewer.timeline.segments.find(item => item.step.id === 'third-drive');
    const time = segment.startTime + segment.contactTime - 0.03;
    viewer.applyAtTime(time);
    return Object.fromEntries([...viewer.playerObjects].map(([id, root]) => [id, root.userData.animation]));
  });
  expect(state.player1.planted).toBe(true);
  expect(state.player1.locomotion).toBe(false);
  const plantedPosition = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const segment = viewer.timeline.segments.find(item => item.step.id === 'third-drive');
    viewer.applyAtTime(segment.startTime + segment.contactTime + 0.08);
    return viewer.playerObjects.get('player1').position.toArray();
  });
  const contactPosition = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD;
    const segment = viewer.timeline.segments.find(item => item.step.id === 'third-drive');
    viewer.applyAtTime(segment.startTime + segment.contactTime);
    return viewer.playerObjects.get('player1').position.toArray();
  });
  expect(plantedPosition).toEqual(contactPosition);
  expect(Object.values(state).slice(1).some(player => player.locomotion || player.phase === 'split-step')).toBe(true);
});

test('pause freezes player pose and ball together, rate scales both, and restart restores ready', async ({ page }) => {
  await openPlay(page, 'third-shot-drop');
  await page.locator('#threeDRate').selectOption('0.25');
  await page.locator('#threeDPlayPause').click();
  await page.waitForTimeout(250);
  await page.locator('#threeDPlayPause').click();
  const before = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD; const root = viewer.playerObjects.get('player1');
    return { elapsed: viewer.clock.elapsed, ball: viewer.ballObject.position.toArray(), arm: root.userData.nodes.RightArm.rotation.toArray() };
  });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => {
    const viewer = window.pickleboard.threeD; const root = viewer.playerObjects.get('player1');
    return { elapsed: viewer.clock.elapsed, ball: viewer.ballObject.position.toArray(), arm: root.userData.nodes.RightArm.rotation.toArray() };
  });
  expect(after).toEqual(before);
  await page.locator('#threeDRestart').click();
  const restart = await page.evaluate(() => ({ elapsed: window.pickleboard.threeD.clock.elapsed, animations: [...window.pickleboard.threeD.playerObjects.values()].map(root => root.userData.animation.phase) }));
  expect(restart.elapsed).toBe(0);
  expect(restart.animations).toEqual(['ready', 'ready', 'ready', 'ready']);
});

test('3D Previous and Next seek logical endpoints and reduced motion remains inspectable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPlay(page, 'fifth-shot-drop');
  await expect(page.locator('#threeDPrevious')).toBeDisabled();
  await page.locator('#threeDNext').click();
  expect(await page.evaluate(() => window.pickleboard.threeD.currentStepIndex())).toBe(1);
  await page.locator('#threeDPrevious').click();
  expect(await page.evaluate(() => window.pickleboard.threeD.currentStepIndex())).toBe(0);
  expect(await page.evaluate(() => [...window.pickleboard.threeD.playerObjects.values()].every(root => root.userData.animation.phase === 'ready'))).toBe(true);
});
