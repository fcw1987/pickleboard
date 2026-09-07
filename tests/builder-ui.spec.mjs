import { expect, test } from '@playwright/test';

const fixture = { title: 'Starter rally', shots: [
  { id: 'shot-serve', family: 'serve', hitter: 'player3', receiver: 'auto', contactStyle: 'auto', target: { x: 13, y: 8 }, arc: 'high', pace: 'soft', movement: { intent: 'recover', pinned: false }, serveMethod: 'drop' },
  { id: 'shot-return', family: 'return', hitter: 'player1', receiver: 'auto', contactStyle: 'auto', target: { x: 7, y: 35 }, arc: 'medium', pace: 'firm', movement: { intent: 'recover', pinned: false } },
  { id: 'shot-third', family: 'drop', hitter: 'player3', receiver: 'auto', contactStyle: 'auto', target: { x: 10, y: 17 }, arc: 'medium', pace: 'medium', movement: { intent: 'advance', pinned: false } }
], players: { player1: { handedness: 'right' }, player2: { handedness: 'left' }, player3: { handedness: 'right' }, player4: { handedness: 'left' } }, assistance: { autoShading: false, showGuides: false }, opening: 'serve', ending: 'stop' };

test.describe('court first builder UI harness', () => {
  test('mounts an accessible starter rally and reports authored controls', async ({ page }) => {
    await page.goto('/index.html?builder-ui-harness=1');
    await page.evaluate(async fixtureValue => {
      const { mountBuilderUI } = await import('/builder-ui.js');
      window.__builderActions = [];
      window.__builder = mountBuilderUI({ onAction: (type, payload) => {
        window.__builderActions.push({ type, payload });
        if (type === 'workspace') window.__builder.render({ workspace: payload });
      } });
      window.__builder.render({ document: fixtureValue, selectedShotId: 'shot-serve' });
    }, fixture);
    await expect(page.locator('.builder-ui')).toBeVisible();
    await expect(page.locator('.builder-shot')).toHaveCount(3);
    await expect(page.locator('.builder-court-region')).toHaveAttribute('aria-label', /3D rally court/);
    await page.getByRole('button', { name: 'Add shot' }).click();
    await page.getByRole('button', { name: 'Place target on court' }).click();
    await page.getByRole('button', { name: '2D' }).click();
    const actions = await page.evaluate(() => window.__builderActions);
    expect(actions.map(action => action.type)).toEqual(['addShot', 'placeTarget', 'view']);
    expect(actions[1].payload).toEqual({ shotId: 'shot-serve' });
  });

  test('keeps a single session while switching planner and assistance controls', async ({ page }) => {
    await page.goto('/index.html?builder-ui-harness=1');
    await page.evaluate(async fixtureValue => {
      const { mountBuilderUI } = await import('/builder-ui.js');
      window.__builderActions = [];
      window.__builder = mountBuilderUI({ onAction: (type, payload) => {
        window.__builderActions.push({ type, payload });
        if (type === 'workspace') window.__builder.render({ workspace: payload });
      } });
      window.__builder.render({ document: fixtureValue, selectedShotId: 'shot-serve' });
    }, fixture);
    await page.getByRole('button', { name: 'Court Planner' }).click();
    await expect(page.locator('.builder-planner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use as starting layout' })).toBeVisible();
    await page.getByRole('button', { name: 'Return to builder' }).first().click();
    await page.getByRole('checkbox', { name: /Auto Shading/ }).check();
    const actions = await page.evaluate(() => window.__builderActions);
    expect(actions.map(action => action.type)).toEqual(['workspace', 'workspace', 'assistance']);
    expect(actions[2].payload).toEqual({ field: 'autoShading', value: true });
  });

  test('opens templates, imports raw JSON, and keeps title focus free of click actions', async ({ page }) => {
    await page.goto('/index.html?builder-ui-harness=1');
    await page.evaluate(async fixtureValue => {
      const { mountBuilderUI } = await import('/builder-ui.js');
      window.__builderActions = [];
      window.__builder = mountBuilderUI({ onAction: (type, payload) => window.__builderActions.push({ type, payload }) });
      window.__builder.render({ document: fixtureValue, selectedShotId: 'shot-serve', templates: [{ id: 'lesson-one', name: 'Lesson One' }], library: [{ id: 'saved-one', title: 'Saved One' }] });
    }, fixture);
    await page.getByRole('button', { name: 'Learn / Templates' }).click();
    await page.getByRole('button', { name: 'Lesson One' }).click();
    await page.getByRole('button', { name: 'Learn / Templates' }).click();
    await page.getByRole('button', { name: 'Saved One' }).click();
    await page.getByLabel('Play title').click();
    await page.getByLabel('Play title').fill('Focused title');
    await page.getByRole('button', { name: 'Import / Export' }).click();
    await page.getByLabel('JSON backup').fill('{"schemaVersion":1,"title":"Imported"}');
    await page.getByRole('button', { name: 'Import JSON' }).click();
    const actions = await page.evaluate(() => window.__builderActions);
    expect(actions).toEqual([{ type: 'template', payload: 'lesson-one' }, { type: 'open', payload: 'saved-one' }, { type: 'title', payload: 'Focused title' }, { type: 'import', payload: '{"schemaVersion":1,"title":"Imported"}' }]);
  });

  test('keeps zero-shot settings and bounds file imports', async ({ page }) => {
    await page.goto('/index.html?builder-ui-harness=1');
    await page.evaluate(async () => { const { mountBuilderUI } = await import('/builder-ui.js'); window.__builderActions = []; window.__builder = mountBuilderUI({ onAction: (type, payload) => window.__builderActions.push({ type, payload }) }); window.__builder.render({ document: { title: 'Empty', shots: [], players: {}, assistance: {} } }); });
    await expect(page.getByText('Auto Shading')).toBeVisible();
    await expect(page.getByLabel('Starting condition')).toBeVisible();
    await page.getByRole('button', { name: 'Import / Export' }).click();
    await page.getByLabel('Choose JSON file').setInputFiles({ name: 'oversize.json', mimeType: 'application/json', buffer: Buffer.alloc(524 * 1024 + 1) });
    await expect.poll(() => page.evaluate(() => window.__builderActions.at(-1))).toEqual({ type: 'message', payload: 'Import is limited to 524 KiB.' });
  });
});
