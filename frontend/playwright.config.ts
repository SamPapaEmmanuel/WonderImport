import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against a running WonderImport (frontend + API) connected to a TEST Supabase project.
 * They create goods, imports and exports, so never point them at production.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
    { name: 'phone', use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/admin.json' }, dependencies: ['setup'], testMatch: /a11y\.spec\.ts/ },
  ],
});
