import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:3002',
        headless: true,
    },
    webServer: {
        command: 'npm run dev',
        port: 3002,
        reuseExistingServer: true,
        timeout: 30000,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
