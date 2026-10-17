import { createRequire } from 'node:module';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { test, expect, openMenu, overflowingToolbars } from './fixtures.js';

const desktopDir = path.resolve('apps/desktop');
const electronBinary = createRequire(path.join(desktopDir, 'package.json'))('electron') as unknown as string;

// Overrides the browser `page` fixture with the real desktop window.
const desktopTest = test.extend<{ app: ElectronApplication; page: Page }>({
  app: async ({}, use) => {
    const env = { ...process.env };
    delete env.VITE_DEV_SERVER_URL;
    const app = await electron.launch({
      executablePath: electronBinary,
      args: [path.join(desktopDir, 'dist-electron/main.js')],
      cwd: desktopDir,
      env: { ...env, LANG: 'zh_CN.UTF-8' },
    });
    await use(app);
    await app.close();
  },
  page: async ({ app }, use) => {
    const window = await app.firstWindow();
    await window.evaluate(() => localStorage.clear());
    await window.reload();
    await window.locator('.viewport-welcome').waitFor();
    await use(window);
  },
});

desktopTest('the packaged renderer boots in a real Electron window', async ({ app, page }) => {
  expect(await page.evaluate(() => typeof (window as unknown as { l2dApi?: unknown }).l2dApi)).toBe('object');
  await expect(page).toHaveTitle(/L2DEditor$/);

  // The custom title bar is draggable and leaves room for the macOS window controls.
  const header = page.locator('header');
  await expect(header).toHaveCSS('-webkit-app-region', 'drag');
  if (process.platform === 'darwin') await expect(header).toHaveCSS('padding-left', '78px');
  // app-region does not inherit; the interactive cluster opts out of dragging as a whole.
  await expect(page.locator('.editor-toolbar-info')).toHaveCSS('-webkit-app-region', 'no-drag');

  // Native popovers render in the top layer of the Electron window.
  await page.getByRole('button', { name: /窗口|Window|ウィンドウ/ }).click();
  const menu = openMenu(page);
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  const width = await page.evaluate(() => innerWidth);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');

  // The minimum window size keeps every toolbar intact.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1024, 700));
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1024);
  expect(await overflowingToolbars(page)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('electron-min-window.png') });
});
