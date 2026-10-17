---
name: l2deditor-mcp
description: "Operate the current L2DEditor workspace through its MCP stdio server and shared desktop bridge: inspect, edit, preview parameters, seek animation, capture real frames, save, and validate exports. Use for L2DEditor GUI/MCP coordination and headless model work, not for operating the proprietary Cubism editor. 当前编辑器与 MCP 协同操作。"
---

# L2DEditor with MCP

本 skill 用当前仓库的现有命令总线、MCP SDK 和编辑器桥接，不创建第二套编辑引擎。建模质量判断配合 `$live2d-model-building`；当前实现和已知限制见 [editor-contracts.md](references/editor-contracts.md)。

## 先确认真实环境

1. 确认仓库路径、AGENTS.md、构建产物及所用版本。仓库默认候选是当前工作区，不把其他聊天里的路径/版本当作当前事实。
2. 有已连接 MCP 工具时先发现实际 `l2d_*` 工具；没有时可运行现有 `packages/mcp-server/dist/bin.js`，不自动修改用户 Codex 配置或安装另一个服务器。
3. 先 `l2d_gui_state` 检查活动文件、节点页、参数/范围、时间轴、表情、物理和撤销栈。打开另一工程会替换当前文档；如果当前窗口有用户未保存工作，先确认或使用隔离验收窗口。
4. 文件编辑与 GUI 编辑二选一主路径，避免打开的文档和磁盘文件互相覆盖。两者区别和安全顺序见 [editor-contracts.md](references/editor-contracts.md)。
5. 实际工具名/参数以 `listTools` 的 schema 和源码为准，不能根据 AGENTS/旧 README 猜别名。

## 操作循环

`inspect/state → 备份或可恢复版本 → dry-run → 现有命令 → 实际渲染 → lint/动态检查 → save → reload/回读`

- GUI 使用 `l2d_gui_exec` 共用鼠标编辑的撤销栈；`set_parameters` 只改预览，不创建关键形态、不保存。
- 暂停、清除表情、关闭自动待机；烘焙了物理时关闭实时物理。明确设置所有相关参数或指定动画帧，避免旧值残留。
- 截图 `target:model, scale:1` 用于原坐标测量；`target:window` 用于界面/控件验证。不要把缩放后的窗口坐标当作存储网格/UV 坐标。
- 截图应等实际目标帧完成。不要用 state 中的参数值或固定 sleep 代替像素证据。
- 保存后核对路径和哈希；当前另存与 GUI save 会收集纹理，缺资源直接报错。资源路径发生重写时会提示并重置撤销历史；正式包仍需重开验证。

工具的常用调用和录制/验证流程见 [workflows.md](references/workflows.md)。

## 现有 SDK 的轻量入口

若工具未直接接入，可使用 `scripts/mcp-client.mjs`。它加载所选仓库已安装的 MCP SDK，不下载依赖，不自写 JSON-RPC 客户端。

```bash
node <skill>/scripts/mcp-client.mjs --repo <repo> --list
node <skill>/scripts/mcp-client.mjs --repo <repo> --tool l2d_inspect --args '{"projectPath":"/absolute/model.l2dproj"}'
node <skill>/scripts/mcp-client.mjs --repo <repo> --editor-url ws://127.0.0.1:22033 --tool l2d_gui_state --args '{"nodeOffset":0,"nodeLimit":50}'
```

调用会产生图像时用 `--out /absolute/snapshot.png`，不要把 base64 倒进聊天。脚本不启动/替换 GUI、不替用户确认编辑；调用 mutating tool 前仍需遵守用户授权和文档保护。

## 环境与边界

- 当前仓库提交必须签名；远程 Git 改动须有当前回合明确同意。涉及登录态或沙盒禁止的监听/GUI操作按环境要求提权，不绕过。
- 生产/测试不能依赖闭源 Cubism 二进制或本机 Cubism 路径。Wasm/Rust 核心是实际求值与导出实现，GUI 显示和 MCP 同一文档不构成外部播放器兼容证明。
- Rust 改动后先 `cargo test --workspace`，重建 Web/Node Wasm，再构建 TS 与跑测试。验收构建用 `L2D_DESKTOP_BUILD_ROOT` 隔离，不能让旧 Vite 覆盖结果。
- 碰到新坑，更新 [editor-contracts.md](references/editor-contracts.md) 的当前限制，并在通用 skill 的坑账本记录可复现证据。不要把未测能力写成已通过。
