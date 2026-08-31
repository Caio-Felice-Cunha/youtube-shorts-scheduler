import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/site',
  fullyParallel: true,
  webServer: { command: 'npx http-server site -p 4174 -c-1', port: 4174, reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
