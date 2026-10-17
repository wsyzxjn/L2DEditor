# 当前编辑器契约

核对基准：L2DEditor 本地源码与实际 GUI/MCP 流程，2026-10-15。版本/工具变化时重新发现，不依赖此快照猜参数。

本轮 SDK `listTools` 实测 31 个工具，其中 12 个 GUI 工具；headless inspect 已通过。默认 22033 无服务时会返回明确连接错误，不能把它当作模型损坏或无权使用；对已启动的实际端口另做 GUI 验证。

配套 SDK helper 已在 v5 独立 Electron 窗口/端口实际验证：初始只读 state、3 节点分页、dry-run 不改文档/撤销栈、实际编辑与 Undo/Redo、截图写文件不输出 base64、同纹理目录另存并重开、重载后同一动作帧图像哈希一致、源工程及所有纹理哈希不变。此证据只覆盖所列流程，不证明任意命令或跨目录资源搬运正确。

## 连接与资源

- stdio 服务：`node packages/mcp-server/dist/bin.js`；GUI 不是这个命令启动的。
- 桌面桥默认 `ws://127.0.0.1:22033`。GUI 端用 `L2D_EDITOR_PORT`，MCP 端用 `L2D_EDITOR_URL`，两者必须一致。桥只接受 loopback，不能放到公网以“让连接更方便”。
- `apps/desktop/electron/editorBridge.ts` 将 `l2d.editor` 请求顺序送给实际窗口；不要另造 WebSocket 编辑/撤销实现。
- 缺构建先使用仓库的 pnpm/build 流程。端口被占、沙盒无法监听或 GUI 禁止启动时，检查并按授权升级执行；不自动杀用户进程、关闭编辑窗口或修改代理。

## 文件与打开的文档不是一份自动同步对象

| 操作 | 作用 |
| --- | --- |
| `l2d_inspect / l2d_lint / l2d_exec_command / l2d_snapshot` | 磁盘工程；文件变了不等于当前窗口已刷新 |
| `l2d_gui_state / l2d_gui_exec` | 当前 GUI 内存文档；GUI edits 使用同一 Command Bus/undo 栈 |
| `l2d_gui_set_parameters / expression / playback` | 预览状态；不保存，不创建关键形态 |
| `l2d_gui_save` | 将 GUI 文档写到明确路径；不复制相对纹理到新目录 |

避免 GUI 保存覆盖 headless 文件修改。先明确主路径，备份整套工程/纹理；打开文件或重载前保护当前未保存文档。读取节点页时用 `nextNodeOffset`，重复显示名称不能代替唯一 ID。

## 当前 12 个 GUI 工具

| 工具 | 参数例/用途 |
| --- | --- |
| `l2d_gui_state` | `{nodeOffset:0,nodeLimit:50}`；返回活动文件/节点页/参数、表情、显示模式、timeline、history |
| `l2d_gui_open_project` | `{path:"/absolute/model.l2dproj"}` 或 JSON；替换当前文档 |
| `l2d_gui_select` | `{nodeIds:["head"]}`；空数组清选择 |
| `l2d_gui_set_parameters` | `{values:{ParamEyeLOpen:0}}`；整批验证 ID、锁定与范围 |
| `l2d_gui_viewport` | `{fit:true,physics:false,autoIdle:false}`；还支持 zoom/pan/flipped/solo/meshEdit/gridSnap |
| `l2d_gui_playback` | `{animationId:"idle",frame:36,playing:false}`；seek 会求值参数轨道 |
| `l2d_gui_expression` | `{expressionId:"smile"}`，或 `null` 清除；先 state 发现实际表情 ID |
| `l2d_gui_show_panel` | `{panel:"viewport"}`；可选 hierarchy/parameters/inspector/timeline/physics/history |
| `l2d_gui_exec` | `{command:{id:"edit-1",name:"...",params:{...}},dryRun:true}`；成功后按授权去掉 dryRun |
| `l2d_gui_history` | `{operation:"undo"}` / redo / `{operation:"jump",index:...}`；先看 history |
| `l2d_gui_save` | `{path:"/absolute/sibling.json"}` 或当前路径；跨目录需另处理资源 |
| `l2d_gui_screenshot` | `{target:"model",scale:1}`；`window` 包含控件，scale 范围 0.1..2 |

以服务 `listTools` 的 JSON schema 校验；不要把此表当作全量参数定义。

## Headless 名称差异

本次实际服务为 `l2d_exec_command` 和 `l2d_snapshot`，不是假定的 `l2d_exec`/`l2d_render_snapshot`。`l2d_exec_command` 的实参是 `projectPath, command, dryRun`，不要混用 GUI 的 `command,dryRun`。

CLI 已有 inspect/lint/exec/render/import-psd/update-psd/auto-rig/ai-face-rig/export/import-bundle/export-psd/export-template/bake-physics/render-video 等能力。具体选项使用当前 `--help`。官方名字存在不证明任意输入都正确。

## 坐标与渲染

模型存储顶点、求值后顶点、纹理裁切 UV、图集 UV、屏幕坐标和 `screenshot scale` 是不同坐标系。截图测量先固定原坐标/画布平移；网格编辑要确认命令期望 rest/model-space，不把未逆变形的当前屏幕点直接写回基础网格。

Rust/Wasm 与 JS 当前保留引用中的零透明度 mask mesh；本体不绘制。`visible:false` 仍被剔除，不能用来代替 `opacity:0` 做隐藏眼孔。当前 CPU/Pixi renderer 使用被引用网格实际 UV/顶点和纹理 alpha，忽略其 drawable opacity；原几何白色眼孔仍可使用恒定 UV。多 mask 使用 alpha 并集，支持反向与纹理内部透明孔；v5 独立 GUI 实测四个 alpha 案例以及移除/Undo、隐藏/Undo。

`renderReady` 已连接到实际目标帧绘制，截图等待通过 `hasRenderedFrame(frame)`，不靠 sleep。连续播放时拿到的是最新已绘制帧；要逐帧证据先暂停并 seek。

离线 renderer 对单个 mask 的三角形覆盖仍使用规范 winding 和 Skia PathOps，显式 even-odd 裁剪后采样纹理；多张 mask alpha 用 source-over 并集，目标层用 destination-in/out。不再以独立 contour 代替纹理覆盖。对复杂语义遮挡的 GUI/离线一致性按项目重新验。

验收缓存同时核对工程与所有纹理哈希。换 PNG 而不改 JSON 是常见模型操作；只比较工程 SHA256 会错误复用旧 headless 截图。模型截图、连续视频、另存重载结果应对应同一资源 revision。

## 当前已知边界/缺陷

- **【铁律】完整组件严禁手绘，必须走图像生成**：任何完整的新状态组件（闭眼、半闭眼、张嘴内部口型、去眼去嘴面底、遮挡补画等），严禁代理自行手绘、拼凑粗劣色块或用代码算法硬算线条。必须走图像生成管线（基于唯一定稿输入，选用 `precise-object-edit` / `inpainting` 等模式产出高精度透明贴图）。模型求值与变形器负责驱动层级与透明度平滑过渡（Sprite Swap），不代替美术资产生成。禁止使用单一高维变形器直接将睁眼纹理在 Y 轴暴力压扁，避免产生断续条形码与眼窝空洞。
- v6 视频眼白越出脸/侧发的问题已确认，不能再称为普通锯齿。v7 重新按真实眼孔拆分，保持原眼部 keyforms、参数域和动作，侧发在相同 head 网格上恢复前景遮挡；完整模型仍有颈圈等未解决项。
- 对眼睛越界的回归，v7 在同一 GUI 用 `set_parameters` 只切换双眼开/闭、截图、恢复原开度并检查恢复一致；没有写入 rig 或模型文件。三个代表状态的可信侧发区域最大 RGB 差 1、超 2 像素为 0。CPU 只定位 source-space probe，不能把 GPU/CPU 场景差直接归因为眼部越界；全资源 revision、原始 PNG 与实际用例名单是证据。
- v6 的口型验收区分网格轴和真实墨迹：原图局部脸方向、纹理主轴和头部姿态都要保留。眼部 keyforms 普通烘焙在实际 Rust/Wasm head 三角表面上，不使用第二套实时求值器；默认 idle/showcase 固定身体，三个 diagnostic 动作另留。录制用暂停 seek、`physics:false, autoIdle:false`，所有源工程及纹理哈希保持不变。
- v6 实际捕获 15 个 GUI 状态，包括完全张嘴、笑嘴和 0.45 开度/眼球 XY 极值/30 度 yaw；新增 cases 不会自动加入独立 captureNames。必须核对真实 result 项及资源 revision，不能把 headless 字典当成 GUI 证据。实际 672 帧固定身体预览和 skill helper 的编辑/撤销/另存回读通过；眼白极值的锯齿、颈圈/围巾的细接缝仍单独保留。
- v6 四个 alpha fixture 项目重载留下 8 条 Pixi BindGroup source/sampler 释放警告，另有开发 CSP 警告。截图和页面错误检查通过不代表资源生命周期已修；见通用坑账本 P41。本轮未过滤或声称解决这些 warning。
- `mesh.add_vertex` 有重复注册、GUI payload 漂移、最近质心选面和默认全画布 UV 的问题，已定位但本轮未修。用前核对实际实现和 dry-run，不自动推广为可靠编辑。
- 原 source-pixel 分区版本存在缺口/残影和歪嘴；v4 验证嘴部 XY 锚点及 1,377 个 Head XYZ 发根样本，补齐颈圈并录制真实 GUI 动作。颈圈大块露底收敛，但后发/抬臂的材质接缝和细边未全部通过，静态像素结果不能作完整模型验收。
- v5 已修复运行包回读的纹理 ID、真实尺寸和 CPU atlas copy 采样问题。单张 4096 图集的本模型回读自然姿态无 RGB 差，摇头、抬臂、张嘴所测姿态最大差 2。实际颜色/缺失文件/损坏图像/大 UV 偏移/缩小素材有独立回归；标准第三方 MOC3 的多纹理索引、外部播放器未由此覆盖。
- 24fps/288 帧若 CLI 编码默认 30fps，时长会变。编码 FPS 显式匹配，或明确真正重采样；`-r` 当前不是轨道重采样能力。
- v3 的 `showcase` 每侧头发各 27 帧越界，最大绝对值约 1.698；v4 已调整输出 scale 并用现有 Rust/Wasm API 重新烘焙三个原动作，所测 816 帧已在范围内。任意实时输入/其他 FPS 未由此验证，输入域与几何夹紧不能混为一谈。
- Electron CSP 开发安全警告与仓库既有 Rust formatting 问题尚未在此工作中修复；单独报告，不为模型任务做全仓无关修改。

源码入口：`packages/mcp-server/src/editor-tools.ts`、`editor-protocol.ts`、`server.ts`，`apps/desktop/electron/editorBridge.ts`、`src/components/EditorAutomation.tsx`、`ViewportPanel.tsx`。

本轮额外发现 headless 遮罩边界丢共享顶点岛：实际三角形的 winding coverage + Skia PathOps 修复了专项 fixture。v4 隔离新构建已实测十二个状态、MCP 编辑/撤销/重做/保存重载；复杂姿态保留实际 GUI/离线差异，不能因为简单眼孔通过就跳过语义遮挡。
