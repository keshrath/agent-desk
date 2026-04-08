import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3496;
const WEB_TOKEN = 'playwright-e2e-token';

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

  // The 'web' project boots the @agent-desk/server and runs browser-based
  // tests against the served UI. The 'electron' project keeps the existing
  // electron-launch test surface.
  webServer: {
    command: 'node packages/server/dist/index.js',
    url: `http://127.0.0.1:${WEB_PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    env: {
      AGENT_DESK_PORT: String(WEB_PORT),
      AGENT_DESK_TOKEN: WEB_TOKEN,
    },
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'electron',
      testIgnore: '**/web/**',
      use: {},
    },
    {
      name: 'web',
      testMatch: '**/web/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${WEB_PORT}`,
        extraHTTPHeaders: {},
      },
    },
  ],
});
