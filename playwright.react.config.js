import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /react-routes\.spec\.js/,
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
    screenshot: 'on',
    video: 'off',
    trace: 'off',
    ignoreHTTPSErrors: true,
    // --mute-audio silences speechSynthesis + audio effects during tests so
    // running the suite in headed mode (or even on a machine with audio out)
    // doesn't blast the kid voice on every Slice 3.1 run.
    launchOptions: {
      args: ['--mute-audio'],
    },
  },
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
