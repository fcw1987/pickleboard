import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({
  ...base,
  outputDir: 'test-results/webkit',
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
