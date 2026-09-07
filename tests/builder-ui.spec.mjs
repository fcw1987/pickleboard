import { expect, test } from '@playwright/test';

test.describe('court first builder UI harness', () => {
  test('mounts an accessible starter rally and reports authored controls', async ({ page }) => {
    await page.goto('/index.html?builder-ui-harness=1');
    await page.evaluate(async () => {
      const { mountBuilderUI } = await import('/builder-ui.js');
      window.__builderActions = [];
      window.__builder = mountBuilderUI({ onAction: (type, payload) => {
        window.__builderActions.push({ type, payload });
        if (type === 'workspace') window.__builder.render({ workspace: payload });
      } });
    });
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
    await page.evaluate(async () => {
      const { mountBuilderUI } = await import('/builder-ui.js');
      window.__builderActions = [];
      window.__builder = mountBuilderUI({ onAction: (type, payload) => {
        window.__builderActions.push({ type, payload });
        if (type === 'workspace') window.__builder.render({ workspace: payload });
      } });
    });
    await page.getByRole('button', { name: 'Court Planner' }).click();
    await expect(page.locator('.builder-planner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use as starting layout' })).toBeVisible();
    await page.getByRole('button', { name: 'Return to builder' }).first().click();
    await page.getByRole('checkbox', { name: /Auto Shading/ }).check();
    const actions = await page.evaluate(() => window.__builderActions);
    expect(actions.map(action => action.type)).toEqual(['workspace', 'workspace', 'assistance']);
    expect(actions[2].payload).toEqual({ field: 'autoShading', value: true });
  });
});
