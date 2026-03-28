import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  globalTimeout: 600_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: './test-results',
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  projects: [
    {
      name: 'electron',
      use: {},
    },
  ],
});
