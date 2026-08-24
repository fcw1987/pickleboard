import { expect, test } from '@playwright/test';

const APP_PATH = '/index.html?e2e=1';

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(APP_PATH);
  await expect.poll(() => page.evaluate(() => Boolean(window.pickleboard))).toBe(true);
  return errors;
}

async function openMenu(page) {
  if (!await page.locator('#menuOverlay').evaluate(element => element.classList.contains('active'))) {
    await page.locator('#menuToggle').click();
  }
}

async function appState(page) {
  return page.evaluate(() => ({
    mode: window.pickleboard.currentGameMode,
    checkedMode: document.querySelector('input[name="gameMode"]:checked')?.value,
    positions: window.pickleboard.getTokenPositions(),
    playerClasses: Object.fromEntries([1, 2, 3, 4].map(number => [
      `player${number}`,
      [...document.querySelector(`#player${number}`).classList]
    ])),
    displays: Object.fromEntries([3, 4].map(number => [
      `player${number}`,
      getComputedStyle(document.querySelector(`#player${number}`)).display
    ]))
  }));
}

test('initializes without uncaught JavaScript errors', async ({ page }) => {
  const errors = await openApp(page);
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
});

test('drawing mode remains enabled, creates a stroke, and can be disabled', async ({ page }) => {
  await openApp(page);
  await openMenu(page);

  const toggle = page.locator('#drawToggle');
  const controls = page.locator('#drawControls');
  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#court')).toHaveClass(/drawing-mode/);
  await expect(controls).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.pickleboard.drawingMode)).toBe(true);

  await page.locator('#menuClose').click();
  await expect(page.locator('#menuOverlay')).toBeHidden();
  const court = page.locator('#court');
  const box = await court.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('#drawingLayer .drawing-stroke')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.pickleboard.drawingPaths.length)).toBe(1);

  await openMenu(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#court')).not.toHaveClass(/drawing-mode/);
  await expect(controls).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.pickleboard.drawingMode)).toBe(false);
});

test('drag keeps the visible token, hit target, and public state synchronized', async ({ page }) => {
  await openApp(page);
  const target = page.locator('#player1-touch');
  const box = await target.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 70, { steps: 8 });
  await page.mouse.up();

  const synchronized = await page.evaluate(() => {
    const visual = document.querySelector('#player1');
    const hitTarget = document.querySelector('#player1-touch');
    const state = window.pickleboard.getTokenPositions().player1;
    return {
      state,
      visual: { x: Number(visual.getAttribute('cx')), y: Number(visual.getAttribute('cy')) },
      hitTarget: { x: Number(hitTarget.getAttribute('cx')), y: Number(hitTarget.getAttribute('cy')) }
    };
  });

  expect(synchronized.visual).toEqual(synchronized.state);
  expect(synchronized.hitTarget).toEqual(synchronized.state);
  expect(synchronized.state).not.toEqual({ x: 5, y: -1 });
});

test('singles and doubles preserve expected positions, visibility, and teams', async ({ page }) => {
  await openApp(page);
  await openMenu(page);
  await page.locator('input[value="singles"]').check();

  let state = await appState(page);
  expect(state.mode).toBe('singles');
  expect(state.checkedMode).toBe('singles');
  expect(state.positions).toEqual({
    player1: { x: 5, y: -1 }, player2: { x: 15, y: 45 },
    player3: { x: 5, y: 36 }, player4: { x: 15, y: 36 }, ball: { x: 16, y: 45 }
  });
  expect(state.displays).toEqual({ player3: 'none', player4: 'none' });
  expect(state.playerClasses.player1).toContain('team1-player');
  expect(state.playerClasses.player2).toContain('team2-player');

  await page.locator('input[value="doubles"]').check();
  state = await appState(page);
  expect(state.mode).toBe('doubles');
  expect(state.checkedMode).toBe('doubles');
  expect(state.positions).toEqual({
    player1: { x: 5, y: -1 }, player2: { x: 15, y: 14 },
    player3: { x: 5, y: 45 }, player4: { x: 15, y: 45 }, ball: { x: 16, y: 45 }
  });
  expect(state.displays).toEqual({ player3: 'block', player4: 'block' });
  expect(state.playerClasses.player1).toContain('team1-player');
  expect(state.playerClasses.player2).toContain('team1-player');
  expect(state.playerClasses.player3).toContain('team2-player');
  expect(state.playerClasses.player4).toContain('team2-player');
});

test('programmatic mode changes synchronize controls and reset uses authoritative mode', async ({ page }) => {
  await openApp(page);

  const result = await page.evaluate(() => {
    window.pickleboard.setGameMode('singles');
    window.pickleboard.setTokenPosition('player1', 10, 10);
    window.pickleboard.resetPositions();
    return {
      mode: window.pickleboard.currentGameMode,
      checkedMode: document.querySelector('input[name="gameMode"]:checked').value,
      player1: window.pickleboard.getTokenPositions().player1,
      player3Display: getComputedStyle(document.querySelector('#player3')).display
    };
  });

  expect(result).toEqual({
    mode: 'singles', checkedMode: 'singles', player1: { x: 5, y: -1 }, player3Display: 'none'
  });
  await expect(page.evaluate(() => window.pickleboard.setGameMode('invalid'))).resolves.toBe(false);
});

test('theme switches and restores the stored preference', async ({ page }) => {
  await page.goto('/tests/fixtures/cache-setup.html');
  await page.evaluate(() => localStorage.setItem('pickleboard-theme', 'dark'));
  await openApp(page);
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');

  await openMenu(page);
  await page.locator('#themeToggle').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pickleboard-theme'))).toBe('light');

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
});
