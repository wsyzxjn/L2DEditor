import { test as base, expect, type Page } from '@playwright/test';

// Fails a test on any uncaught page error or console error.
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use(errors);
      expect(errors.join('\n')).toBe('');
    },
    { auto: true },
  ],
});

export { expect };

export const statusBar = (page: Page) => page.locator('footer.status-bar');
export const openMenu = (page: Page) => page.locator('.panel-menu:popover-open');
export const tree = (page: Page) => page.getByRole('tree');
export const panelRoot = (page: Page, panelId: string) =>
  page.locator(`.dv-groupview:has([data-tab-panel-id="${panelId}"].dv-active-tab) .panel-root`).first();

export async function addNode(page: Page, kind = '图层文件夹') {
  await page.getByRole('button', { name: '新建节点', exact: true }).click();
  await openMenu(page).getByRole('menuitem', { name: kind }).click();
}

export async function setLanguage(page: Page, language: 'zh-CN' | 'ja' | 'en') {
  await statusBar(page).locator('select').selectOption(language);
}

/** Toolbar-like rows that clip instead of scrolling must not overflow. */
export async function overflowingToolbars(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.panel-root > div:first-child:not(.absolute), header, footer.status-bar')]
      .filter((element) => element.offsetParent && element.scrollWidth > element.clientWidth + 1)
      .map((element) => `${element.className.slice(0, 60)} (${element.scrollWidth}>${element.clientWidth})`),
  );
}
