import { test, expect, statusBar, openMenu, tree, panelRoot, addNode, setLanguage, overflowingToolbars } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.viewport-welcome')).toBeVisible();
});

test('application icon assets are available to the renderer', async ({ page }) => {
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute('href', /(?:^\.?\/)app-icon-32\.png$/);
  const largeIcon = await page.request.get('/app-icon.png');
  const smallIcon = await page.request.get('/app-icon-32.png');
  expect(largeIcon.status()).toBe(200);
  expect(smallIcon.status()).toBe(200);
  expect(largeIcon.headers()['content-type']).toContain('image/png');
  expect((await largeIcon.body()).byteLength).toBeGreaterThan(10_000);
  expect((await smallIcon.body()).byteLength).toBeGreaterThan(300);
});

test('empty state, hierarchy search and clearing', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '开始创建你的模型' })).toBeVisible();
  await addNode(page);
  await addNode(page);
  await expect(page.locator('.viewport-welcome')).toHaveCount(0);

  const search = page.getByRole('textbox', { name: '过滤节点 (Ctrl+F)...' });
  await search.fill('  PART  ');
  await expect(tree(page).getByText('Part 1', { exact: true })).toHaveCount(1);
  await expect(tree(page).getByText('Part 2', { exact: true })).toHaveCount(1);
  await search.fill('nonexistent');
  await expect(page.getByText('没有匹配的节点')).toBeVisible();
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(search).toHaveValue('');
});

test('undo, redo and the saved state in the status bar and window title', async ({ page }) => {
  const undo = page.getByRole('button', { name: '撤销', exact: true });
  await expect(undo).toBeDisabled();
  await expect(page).toHaveTitle('未命名工程 — L2DEditor');
  await expect(statusBar(page)).toContainText('已保存');

  await addNode(page);
  await expect(statusBar(page)).toContainText('未保存');
  await expect(page).toHaveTitle('● 未命名工程 — L2DEditor');

  await undo.click();
  await expect(statusBar(page)).toContainText('已保存');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(tree(page).getByText('Part 1', { exact: true })).toBeVisible();
});

test('command palette highlights the keyboard selection', async ({ page }) => {
  await page.getByRole('button', { name: '命令面板' }).click();
  await expect(page.locator('[cmdk-input]')).toHaveCSS('outline-style', 'none');
  const selected = page.locator('[cmdk-item][data-selected="true"]');
  const first = await selected.innerText();
  await page.keyboard.press('ArrowDown');
  await expect(selected).not.toHaveText(first);
  await expect(selected).toHaveCSS('box-shadow', /inset/);
  await expect(page.locator('[cmdk-root]')).not.toContainText('Run Macro');
  await page.keyboard.press('Escape');
  await expect(page.locator('[cmdk-root]')).toHaveCount(0);
});

test('agent integration explains MCP, Skills and a safe verification prompt', async ({ page }) => {
  await page.getByRole('button', { name: 'Agent 接入' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agent 接入' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('/path/to/L2DEditor/packages/mcp-server/dist/bin.js');
  await expect(dialog.locator('.agent-setup-code-block').first()).toContainText('[mcp_servers.l2deditor]');

  await dialog.getByRole('button', { name: '通用 JSON' }).click();
  await expect(dialog).toContainText('"mcpServers"');
  await expect(dialog).toContainText('ws://127.0.0.1:22033');

  await dialog.getByRole('tab', { name: /Skill · 工作流/ }).click();
  await expect(dialog).toContainText('$HOME/.agents/skills');
  await expect(dialog).toContainText('cp -R');
  await expect(dialog).toContainText('live2d-model-building');

  await dialog.getByRole('tab', { name: /验证 · 联调/ }).click();
  await expect(dialog).toContainText('l2d_gui_state');
  await expect(dialog).toContainText('只读验证 L2DEditor 的 Agent 接入');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: '命令面板' }).click();
  await page.locator('[cmdk-input]').fill('Agent');
  await page.getByRole('option', { name: '连接 Agent：MCP 与 Skills' }).click();
  await expect(page.getByRole('dialog', { name: 'Agent 接入' })).toBeVisible();
});

test('overflow menus stay anchored and run their actions', async ({ page }) => {
  const viewportMenu = panelRoot(page, 'viewport_panel').locator('.panel-menu-trigger');
  await viewportMenu.click();
  const menuBox = await openMenu(page).boundingBox();
  const triggerBox = await viewportMenu.boundingBox();
  expect(menuBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height);
  await openMenu(page).getByRole('menuitemcheckbox', { name: '洋葱皮' }).click();
  await expect(openMenu(page)).toHaveCount(0);
  await expect(viewportMenu).toHaveAttribute('data-active', 'true');
  await viewportMenu.click();
  await expect(openMenu(page).getByRole('menuitemcheckbox', { name: '洋葱皮' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(openMenu(page)).toHaveCount(0);

  await panelRoot(page, 'parameters_panel').locator('.panel-menu-trigger').click();
  await openMenu(page).getByRole('menuitem', { name: '官方标准预设' }).click();
  await expect(statusBar(page)).toContainText('官方标准预设');

  await panelRoot(page, 'timeline_panel').locator('.panel-menu-trigger').click();
  await expect(openMenu(page).getByRole('menuitem', { name: '自动生成面部动作' })).toBeVisible();
  await page.mouse.click(700, 300);
  await expect(openMenu(page)).toHaveCount(0);
});

test('closed panels reopen in place, the layout persists and can be reset', async ({ page }) => {
  const inspectorTab = page.locator('[data-tab-panel-id="inspector_panel"]');
  const parametersTab = page.locator('[data-tab-panel-id="parameters_panel"]');
  await inspectorTab.locator('.dv-default-tab-action').click();
  await expect(inspectorTab).toHaveCount(0);

  await page.getByRole('button', { name: '窗口' }).click();
  const item = openMenu(page).getByRole('menuitemcheckbox', { name: '属性检查器' });
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await item.click();
  await expect(inspectorTab).toHaveCount(1);
  const [inspector, parameters] = [await inspectorTab.boundingBox(), await parametersTab.boundingBox()];
  expect(Math.abs(inspector!.x - parameters!.x)).toBeLessThan(4);
  expect(inspector!.y).toBeGreaterThan(parameters!.y);

  await page.locator('[data-tab-panel-id="timeline_panel"] .dv-default-tab-action').click();
  await page.reload();
  await expect(page.locator('[data-tab-panel-id="timeline_panel"]')).toHaveCount(0);

  await page.getByRole('button', { name: '窗口' }).click();
  await openMenu(page).getByRole('menuitem', { name: '重置布局' }).click();
  await expect(page.locator('.dv-tab[data-tab-panel-id]')).toHaveCount(7);
});

test('toolbars fit at every window size in all three languages', async ({ page }) => {
  for (const [width, height] of [[1024, 700], [1440, 900], [1920, 1080]] as const) {
    await page.setViewportSize({ width, height });
    for (const language of ['zh-CN', 'ja', 'en'] as const) {
      await setLanguage(page, language);
      for (const panel of ['physics_panel', 'parameters_panel']) {
        await page.locator(`[data-tab-panel-id="${panel}"]`).click();
        expect(await overflowingToolbars(page), `${width}x${height} ${language} ${panel}`).toEqual([]);
      }
    }
  }
  await setLanguage(page, 'zh-CN');
  // With contextual tools present, the viewport overflow menu remains reachable.
  await page.setViewportSize({ width: 1024, height: 700 });
  await addNode(page, '弯曲变形器');
  const viewport = panelRoot(page, 'viewport_panel');
  const [trigger, area] = [await viewport.locator('.panel-menu-trigger').boundingBox(), await viewport.boundingBox()];
  expect(trigger!.x + trigger!.width).toBeLessThanOrEqual(area!.x + area!.width - 8);
});

test('tabs keep small radii and narrow sidebars fall back to the tab overflow list', async ({ page }) => {
  await expect(page.locator('.dv-tab.dv-active-tab').first()).toHaveCSS('border-top-left-radius', '4px');
  const sash = await page.locator('.dv-sash.dv-enabled').evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON()).find((box) => box.width === 4 && box.x > 800 && box.height > 500));
  await page.mouse.move(sash.x + 2, sash.y + 150);
  await page.mouse.down();
  await page.mouse.move(1260, sash.y + 150, { steps: 10 });
  await page.mouse.up();
  const header = page.locator('.dv-tabs-and-actions-container:has([data-tab-panel-id="parameters_panel"])');
  await header.locator('.dv-tabs-overflow-dropdown-default').click();
  const list = page.locator('.dv-tabs-overflow-container');
  await expect(list).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await list.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1441);
  await list.locator('.dv-tab').last().click();
  await expect(header.locator('.dv-active-tab')).toHaveCount(1);
});

test('parameters use compact rows and double-click restores the default', async ({ page }) => {
  const parameters = panelRoot(page, 'parameters_panel');
  const slider = parameters.getByRole('slider', { name: 'Eye Left Open' });
  const row = slider.locator('xpath=ancestor::div[contains(@class, "group")][1]');
  expect((await row.boundingBox())!.height).toBe(28);
  await slider.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
  await expect(row).toContainText('0.95');
  // A double-click lands mid-track (0.5) before the handler restores the default.
  await slider.dblclick();
  await expect(row).toContainText('1.00');
});

test('hierarchy supports keyboard navigation, collapsing, renaming and deleting', async ({ page }) => {
  await addNode(page);
  await addNode(page); // Part 2 becomes a child of the selected Part 1.
  const nodes = tree(page);
  await nodes.getByText('Part 1', { exact: true }).click();
  await nodes.focus();

  await page.keyboard.press('ArrowLeft');
  await expect(nodes.getByText('Part 2', { exact: true })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(nodes.getByRole('treeitem', { name: /Part 2/ })).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('F2');
  const rename = nodes.getByRole('textbox', { name: '重命名' });
  await rename.fill('Body');
  await rename.press('Enter');
  await expect(nodes.getByText('Body', { exact: true })).toBeVisible();

  await nodes.focus();
  await page.keyboard.press('Delete');
  await expect(nodes.getByText('Body', { exact: true })).toHaveCount(0);
  await expect(statusBar(page)).toContainText('已删除 1 个节点');

  await panelRoot(page, 'hierarchy_panel').getByRole('button', { name: '更多操作' }).click();
  await expect(openMenu(page).getByRole('menuitem', { name: '全部折叠' })).toBeVisible();
});

test('inspector sections collapse, remember their state and keep the header visible', async ({ page }) => {
  await addNode(page, '弯曲变形器');
  const inspector = panelRoot(page, 'inspector_panel');
  const section = inspector.locator('details', { has: page.getByText('键形快速装配') });
  await expect(section).toHaveAttribute('open', '');
  await section.locator('summary').click();
  await expect(section).not.toHaveAttribute('open', '');
  // The details toggle event is dispatched asynchronously.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('l2d_inspector_section:inspector.quick_setup'))).toBe('closed');

  await section.locator('summary').click();
  const scroller = inspector.locator('xpath=ancestor-or-self::div[contains(@class, "overflow-y-auto")][1]');
  await inspector.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const [header, container] = [await inspector.locator('.sticky').boundingBox(), await scroller.boundingBox()];
  expect(Math.abs(header!.y - container!.y)).toBeLessThan(2);
});

test('timeline explains how to start and lists keyed tracks first', async ({ page }) => {
  const timeline = panelRoot(page, 'timeline_panel');
  await expect(timeline.getByText('这个动作还没有关键帧')).toBeVisible();
  await timeline.getByText('Hair Front Sway', { exact: true }).locator('xpath=..').getByRole('button', { name: '在播放头处添加关键帧' }).click();
  await expect(timeline.getByText('这个动作还没有关键帧')).toHaveCount(0);
  // Row 0 of the track list is its heading.
  await expect(timeline.locator('.w-48 > div').nth(1)).toContainText('Hair Front Sway');
});

test('every visible label follows the selected language', async ({ page }) => {
  await setLanguage(page, 'en');
  await expect(page.locator('[data-tab-panel-id="parameters_panel"]')).toContainText('Parameters');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const cjk = await page.evaluate(() => {
    const text = [...document.body.querySelectorAll<HTMLElement>('*')]
      .filter((element) => !element.closest('[aria-live]') && !element.closest('option') && element.children.length === 0 && element.offsetParent)
      .map((element) => element.textContent)
      .join(' ');
    return text.match(/[\u3040-\u30ff\u4e00-\u9fff]+/g) ?? [];
  });
  expect(cjk).toEqual([]);

  await setLanguage(page, 'zh-CN');
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/Dope Sheet|New Motion|Free Quad|Zoom:|EDITING MESH|PARAMETERS/);
});
