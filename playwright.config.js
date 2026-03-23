import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:3001',
        headless: true,
    },
    webServer: {
        command: 'python3 server.py 3001',
        port: 3001,
        reuseExistingServer: true,
        timeout: 10000,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
