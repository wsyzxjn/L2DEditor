import { defineConfig, devices } from '@playwright/test';

const port = 4180;

export default defineConfig({
  testDir: 'tests/ui',
  // The editor keeps per-window state (layout, language) in localStorage, and the
  // Electron project owns the desktop bridge ports, so tests run one at a time.
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'web',
      testMatch: /editor\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${port}`,
        locale: 'zh-CN',
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: 'electron', testMatch: /electron\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm --filter l2d-desktop exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
