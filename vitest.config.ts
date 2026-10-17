import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Rendered UI tests run under Playwright (`pnpm test:ui`).
    exclude: [...configDefaults.exclude, 'tests/ui/**'],
  },
});
