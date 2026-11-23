import { defineConfig } from '@playwright/test';

// Browser tests for the admin. They run against the real Worker (static files, routing, headers) with every
// /api/admin call answered by e2e/fixtures.js, so no GitHub or Cloudflare credentials are needed.
const PORT = 8799;

export default defineConfig({
    testDir: 'e2e',
    timeout: 30000,
    fullyParallel: true,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', serviceWorkers: 'block' },
    webServer: {
        command: `npx wrangler dev --port ${PORT} --var ADMIN_PASSWORD:e2e-pass`,
        url: `http://localhost:${PORT}/robots.txt`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        stdout: 'ignore'
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
