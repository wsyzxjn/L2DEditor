# GUI / MCP 实用流程

以下参数是形状示例，ID/路径和工具 schema 必须按实际项目发现。

## 只读接入检查

1. 用现有连接的 `listTools`/工具发现能力，或 `scripts/mcp-client.mjs --repo <repo> --list`。
2. 先 headless inspect 验证目标路径可读，再 `l2d_gui_state` 确认窗口/当前文档；无法连接不等于模型坏。
3. 节点逐页获取，依据 ID 追父链；记录 source/filePath、画布、参数范围、activeExpression、timeline 与 display 模式。

## 可恢复 GUI 编辑

1. 若目标文件不是当前文档，先保护当前用户工作。隔离验收窗口优先于覆盖未保存窗口。
2. 备份整个工程或另存同目录 JSON；跨目录同时复制纹理并核对路径。
3. `l2d_gui_exec` dry-run 检查 patches 范围与预期一致；一次逻辑修改共用一次撤销点/事务，不自建 undo。
4. 根据真需求修改几何、层级和关键形态。`set_parameters` 只是试姿态。
5. `target:model,scale:1` 截图 + lint + 相关连续动作；失败先复现/撤销，别靠继续补参数掩盖。
6. save、核对路径/哈希、重新打开，确认贴图和绑定仍正确。

## 确定帧截图

```json
{"tool":"l2d_gui_viewport","arguments":{"fit":true,"physics":false,"autoIdle":false}}
{"tool":"l2d_gui_expression","arguments":{"expressionId":null}}
{"tool":"l2d_gui_playback","arguments":{"animationId":"idle","frame":36,"playing":false}}
{"tool":"l2d_gui_screenshot","arguments":{"target":"model","scale":1}}
```

首次设置 frame 前发现动画 ID、FPS、duration。预览参数直接设置时先恢复所有相关默认值，再设置此次测试值，避免上次极值残留。不要把取帧回应的参数正确当作截图已正确；检查像素/当前项目哈希。

GUI 12 秒待机可以逐帧 `playback(frame,playing:false) → screenshot`，再用现有 FFmpeg 编码；这是实际模型渲染，不是把原图平移做假动效。大批 PNG/base64 放磁盘，不在聊天灌工具图像数据。

## 隔离验收

按仓库工作目录设置：

```bash
L2D_DESKTOP_BUILD_ROOT=out/validation pnpm run build
```

路径相对于构建命令的实际包工作目录；检查生成入口，不猜结果一定在仓库根 `out`。测试窗口设独立 `L2D_EDITOR_PORT` 和用户配置目录，stdio 客户端设相同 URL。保留现有 Vite/编辑窗口。

验证页身份、非空、无错误 overlay、运行日志、模型截图和至少一次真实控制操作；按 DCC 的目标窗口检查，不能把桌面程序强行当移动站点。当前案例测 1440×900、1024×768。

## 交付与回读

从当前保存 JSON/纹理做包；新 GUI 预览/保存后核对资源 revision 和包内哈希。检查引用、纹理实际尺寸和 UV，重新导入及同姿态渲染。v5 的纹理 ID/尺寸和远图集原点采样已修复，但新包仍须做自己的回读；第三方标准 MOC3、多图集和目标播放器分别验证。

视频用 PNG 序列作为输入，显式 `-framerate <animation.fps>`，使用成熟 FFmpeg 编码并 `ffprobe` 检查帧数/FPS/时长/尺寸。脸部 crop 是同一次帧序列裁切，不代替全身缺口检查。

## 修改核心后

依 AGENTS.md：Rust tests → Web/Node Wasm rebuild → TypeScript/Desktop build → 完整测试 → 真实 GUI/MCP 操作。不要只跑 TS typecheck，也不要让旧 Vite 覆盖测试产物。
