import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { test, expect, openMenu, overflowingToolbars } from './fixtures.js';

const desktopDir = path.resolve('apps/desktop');
const electronBinary = createRequire(path.join(desktopDir, 'package.json'))('electron') as unknown as string;

async function freePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!address || typeof address === 'string') throw new Error('Could not allocate an editor port');
  return address.port;
}

async function callEditor(port: number, params: Record<string, unknown>) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const id = randomUUID();
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Editor bridge timed out'));
    }, 10_000);
    socket.onopen = () => socket.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'l2d.editor', params }));
    socket.onmessage = (event) => {
      const response = JSON.parse(String(event.data));
      if (response.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (response.error) reject(new Error(response.error.message));
      else resolve(response.result);
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Cannot connect to editor bridge on ${port}`));
    };
  });
}

// Overrides the browser `page` fixture with the real desktop window.
const desktopTest = test.extend<{ app: ElectronApplication; page: Page; editorPort: number }>({
  editorPort: async ({}, use) => {
    await use(await freePort());
  },
  app: async ({ editorPort }, use) => {
    const env = { ...process.env };
    delete env.VITE_DEV_SERVER_URL;
    const app = await electron.launch({
      executablePath: electronBinary,
      args: [path.join(desktopDir, 'dist-electron/main.js')],
      cwd: desktopDir,
      env: { ...env, LANG: 'zh_CN.UTF-8', L2D_EDITOR_PORT: String(editorPort) },
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

  const setup = await page.evaluate(async () => {
    return (window as unknown as {
      l2dApi: { getAgentSetupInfo: () => Promise<import('../../apps/desktop/electron/preload.js').AgentSetupInfo> };
    }).l2dApi.getAgentSetupInfo();
  });
  expect(path.normalize(setup.repoRoot)).toBe(path.resolve('.'));
  expect(path.normalize(setup.mcpServerPath)).toBe(path.resolve('packages/mcp-server/dist/bin.js'));
  expect(setup.mcpServerBuilt).toBe(true);
  expect(setup.editorUrl).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);

  await page.getByRole('button', { name: /Agent 接入|Agent integration|Agent 接続/ }).click();
  const setupDialog = page.getByTestId('agent-setup-modal');
  await expect(setupDialog).toBeVisible();
  await expect(setupDialog).toContainText(setup.repoRoot);
  await expect(setupDialog).toContainText(setup.editorUrl);
  const [dialogBox, windowSize] = [
    await setupDialog.boundingBox(),
    await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
  ];
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(windowSize.width);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(windowSize.height);
  expect(await setupDialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  const codexBlock = setupDialog.locator('.agent-setup-code-block').filter({ hasText: '[mcp_servers.l2deditor]' });
  await codexBlock.getByRole('button', { name: '复制' }).click();
  await expect(codexBlock.getByRole('button', { name: '已复制' })).toBeVisible();
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toContain('[mcp_servers.l2deditor]');
  await page.screenshot({ path: test.info().outputPath('agent-setup-min-window.png') });

  await setupDialog.getByRole('tab', { name: /Skill · 工作流/ }).click();
  await expect(setupDialog).toContainText('安装本地 Skills');
  await expect(setupDialog).toContainText('$HOME/.agents/skills');
  await page.screenshot({ path: test.info().outputPath('agent-skills-min-window.png') });

  await setupDialog.getByRole('tab', { name: /验证 · 联调/ }).click();
  await expect(setupDialog).toContainText('只读验证提示词');
  await expect(setupDialog).toContainText('l2d_gui_state');
  expect(await setupDialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('agent-verify-min-window.png') });

  await page.keyboard.press('Escape');
  await expect(setupDialog).toHaveCount(0);

  await page.screenshot({ path: test.info().outputPath('electron-min-window.png') });
});

desktopTest('AI activity is visible and its change can be undone safely', async ({ app, page, editorPort }) => {
  const command = {
    id: 'agent-demo-node',
    name: 'node.add',
    params: {
      id: 'agent_demo_node',
      name: 'AI 演示节点',
      parent_id: null,
      visible: true,
      locked: false,
      kind: { type: 'Part', collapsed: false },
    },
  };

  await callEditor(editorPort, { action: 'exec', command, dryRun: true });
  const card = page.getByTestId('agent-activity-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('node.add');
  await expect(card).toContainText('预演');

  await callEditor(editorPort, { action: 'exec', command: { ...command, id: 'agent-demo-node-applied' }, dryRun: false });
  await callEditor(editorPort, { action: 'select', nodeIds: ['agent_demo_node'] });
  await expect(card).toContainText('定位节点');
  await expect(card.getByRole('button', { name: '撤销 AI 修改' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('ai-activity.png') });

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1024, 700));
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1024);
  const [activityBox, statusBox] = [await card.boundingBox(), await page.locator('footer.status-bar').boundingBox()];
  expect(activityBox!.x + activityBox!.width).toBeLessThanOrEqual(1024);
  expect(activityBox!.y + activityBox!.height).toBeLessThanOrEqual(statusBox!.y - 4);

  await card.getByRole('button', { name: '撤销 AI 修改' }).click();
  await expect(card).toContainText('已撤销');
  const state = await callEditor(editorPort, { action: 'state', nodeOffset: 0, nodeLimit: 10 });
  expect(state.nodeCount).toBe(0);
  expect(state.selectedNodeIds).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('ai-activity-undone.png') });
});
