import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    use: { baseURL: 'http://localhost:5000', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    webServer: { command: 'npm run dev', url: 'http://localhost:5000', reuseExistingServer: !process.env.CI },
});
