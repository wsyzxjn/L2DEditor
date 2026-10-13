import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type SupportedLanguage = 'zh-CN' | 'ja' | 'en';
export type LanguageSetting = 'auto' | SupportedLanguage;

export function detectSystemLanguage(systemLocale?: string): SupportedLanguage {
  const loc = (
    systemLocale ||
    (typeof navigator !== 'undefined' ? navigator.language : '') ||
    'en'
  ).toLowerCase();

  if (loc.startsWith('zh')) return 'zh-CN';
  if (loc.startsWith('ja')) return 'ja';
  return 'en';
}

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  'zh-CN': {
    // Toolbar & App
    'app.title': 'L2DEditor',
    'toolbar.new': '新建',
    'toolbar.open': '打开',
    'toolbar.save': '保存',
    'toolbar.save_as': '另存为',
    'toolbar.import_psd': '导入 PSD',
    'toolbar.atlas': '纹理集 (Atlas)',
    'toolbar.undo': '撤销',
    'toolbar.redo': '重做',
    'toolbar.commands': '命令面板',
    'toolbar.language': '语言',
    'toolbar.lang_auto': '自动 (系统语言)',
    'toolbar.lang_zh': '简体中文',
    'toolbar.lang_ja': '日本語',
    'toolbar.lang_en': 'English',

    // Hierarchy Panel
    'hierarchy.title': '部件层级树',
    'hierarchy.warp': '弯曲变形器',
    'hierarchy.rot': '旋转变形器',
    'hierarchy.part': '图层文件夹',
    'hierarchy.path': '艺术路径',
    'hierarchy.cleanup': '清理空节点与无用参数',
    'hierarchy.filter_placeholder': '过滤节点 (Ctrl+F)...',
    'hierarchy.no_nodes': '暂无节点',
    'hierarchy.click_add': '点击上方 + 按钮添加，或导入分层 PSD 文件',
    'hierarchy.visible_on': '显示',
    'hierarchy.visible_off': '隐藏',
    'hierarchy.lock_on': '已锁定',
    'hierarchy.lock_off': '未锁定',

    // Viewport Panel
    'viewport.title': '视口画布',
    'viewport.tool_select': '选择工具',
    'viewport.tool_add_vertex': '添加顶点',
    'viewport.tool_delete_vertex': '删除顶点',
    'viewport.mesh_edit': '网格编辑',
    'viewport.wireframe': '线框',
    'viewport.onion_skin': '洋葱皮',
    'viewport.motion_path': '运动轨迹',
    'viewport.auto_idle': '自然呼吸',
    'viewport.physics': '实时物理',
    'viewport.reset_camera': '重置视角',
    'viewport.selected_vertex': '选中顶点',
    'viewport.grid_snap': '网格吸附',

    // Parameters Panel
    'parameters.title': '参数控制台',
    'parameters.reset_all': '全部重置',
    'parameters.add_group': '新建分组',
    'parameters.preset': '官方标准预设',
    'parameters.add_param': '新建参数',
    'parameters.no_params': '暂无参数。点击 + 新建参数添加。',
    'parameters.no_params_in_group': '该分组内暂无参数',
    'parameters.lock_param': '锁定参数',
    'parameters.unlock_param': '解锁参数',
    'parameters.keyform_dot': '键形位置',
    'parameters.xy_pad': '2D 摇杆控制 (XY Pad)',
    'parameters.xy_pad_reset': '双击复位默认值',
    'parameters.filter_placeholder': '过滤参数 (Ctrl+F)...',

    // Inspector Panel
    'inspector.title': '属性检查器',
    'inspector.canvas_props': '画布尺寸设置',
    'inspector.width': '宽度 (px)',
    'inspector.height': '高度 (px)',
    'inspector.node_id': '节点唯一标识 (ID)',
    'inspector.node_name': '部件显示名称',
    'inspector.quick_setup': '键形快速装配',
    'inspector.key2': '+ 2 键 (0, 1)',
    'inspector.key3': '+ 3 键 (-30, 0, 30)',
    'inspector.synthesize_corners': '四角自动合成 (Ctrl+4)',
    'inspector.restore_shape': '还原原始形状',
    'inspector.shape_copy_paste': '键形姿态复制 / 粘贴',
    'inspector.copy_shape': '复制姿态',
    'inspector.paste_mirrored': '镜像粘贴至相反键',
    'inspector.part_folder': '部件文件夹属性',
    'inspector.folder_opacity': '文件夹不透明度 (级联)',
    'inspector.warp_grid': '弯曲控制网格',
    'inspector.cols': '水平列数',
    'inspector.rows': '垂直行数',
    'inspector.auto_turn_xy': '一键建立转头空间 (3x3)',
    'inspector.auto_sway': 'AI 自动摇晃动力学 (揺れ)',
    'inspector.delete_bake': '删除变形器并将形变烘焙至子节点',
    'inspector.rot_deformer': '旋转变形器属性',
    'inspector.origin_x': '旋转中心 X',
    'inspector.origin_y': '旋转中心 Y',
    'inspector.angle': '旋转角度 (deg)',
    'inspector.mesh_geo': '网格几何属性',
    'inspector.vertices': '顶点数',
    'inspector.triangles': '三角形数',
    'inspector.opacity': '不透明度',
    'inspector.hit_area': '触摸检测标签 (Hit Area)',
    'inspector.user_data': '自定义元数据 (User Data)',
    'inspector.morph_targets': '形态键 / 混合形状 (BlendShapes)',
    'inspector.add_morph': '+ 新建形态键',
    'inspector.reverse_winding': '反转三角形法线绕向',
    'inspector.create_enclosing_warp': '创建自适应包裹弯曲变形器',
    'inspector.fit_contour_path': '沿外轮廓拟合艺术路径',
    'inspector.artpath_stroke': '动态艺术路径画笔',
    'inspector.control_points': '控制点',
    'inspector.closed': '闭合',
    'inspector.open': '开放',
    'inspector.thicken': '+ 加粗笔画',
    'inspector.thin': '- 减细笔画',

    // Timeline Panel
    'timeline.title': '时间轴动画师 (Timeline)',
    'timeline.play': '播放',
    'timeline.pause': '暂停',
    'timeline.fps': '帧率 (FPS)',
    'timeline.duration': '总时长 (帧)',
    'timeline.loop': '循环播放',
    'timeline.auto_smooth': '贝塞尔自动平滑 (Auto Smooth)',
    'timeline.lipsync': '音频对口型 (LipSync)',
    'timeline.export_video': '导出视频 (MP4/WebM)',
    'timeline.no_tracks': '暂无动画轨道。在参数面板调参或点击对口型生成动画。',

    // Physics Panel
    'physics.title': '物理摆动配置 (Physics)',
    'physics.presets': '物理预设',
    'physics.preset_hair_short': '短发',
    'physics.preset_hair_long': '长发',
    'physics.preset_skirt': '裙摆',
    'physics.preset_ribbon': '丝带/飘带',
    'physics.add_group': '新建物理组',
    'physics.inputs': '输入参数 (加速度来源)',
    'physics.outputs': '输出参数 (受动部件)',
    'physics.pendulums': '钟摆链小球',
    'physics.add_pendulum': '+ 添加钟摆节点',
    'physics.length': '长度',
    'physics.damping': '阻尼衰减',
    'physics.mass': '质量',
    'physics.ground_y': '地面判定碰撞线 (Y)',
    'physics.max_radius': '最大活动半径',
    'physics.bake_physics': '烘焙物理摆动至动画轨道',
    'physics.no_groups': '暂无物理配置。点击上方预设或 + 新建物理组添加。',

    // History Panel
    'history.title': '历史记录 (Undo Tree)',
    'history.initial_state': '工程初始状态',
    'history.step': '步',
    'history.no_history': '暂无撤销历史。所有命令总线提交将自动记录于此。',

    // Atlas Modal
    'atlas.title': '纹理集排布 (Texture Atlas)',
    'atlas.size': '纹理集尺寸 (px)',
    'atlas.padding': '贴图间距 (Padding)',
    'atlas.pack_button': '重新排布纹理集',
    'atlas.generating': '正在计算 2D 货架装箱与 UV 重映射...',
    'atlas.sheets_count': '生成贴图张数',
    'atlas.remap_notice': '点击应用将自动重映射所有网格的 UV 坐标并保存至 textures/ 目录。',
    'atlas.apply_button': '应用纹理集并保存',

    // Command Palette
    'palette.placeholder': '输入命令或快捷键搜索 (例如: Export, Turn XY, 4-Corner)...',
    'palette.no_results': '未找到匹配的命令',
    'palette.group_file': '工程文件与资产',
    'palette.group_edit': '编辑操作',
    'palette.group_macro': '自动化装配宏',
    'palette.group_view': '视口与显示',
    'palette.group_export': '发布与导出',

    // Notifications
    'notify.new_project': '已创建空白新工程',
    'notify.saved': '工程已保存',
    'notify.save_failed': '保存工程失败',
    'notify.opened': '已加载工程',
    'notify.psd_imported': '成功导入 PSD 原画并生成三角形网格',
    'notify.undo': '已撤销',
    'notify.redo': '已重做',
    'notify.cleaned_empty': '已清理全部空文件夹、空变形器与未引用参数',
    'notify.synthesized_corners': '四角合成完成 (Ctrl+4)',
    'notify.setup_turn_xy': '已自动建立 3x3 头部转面形变空间',
    'notify.auto_sway': '已自动生成摇摆动力学与物理摆动',
    'notify.lang_changed': '界面语言已切换',
  },
  'ja': {
    // Toolbar & App
    'app.title': 'L2DEditor',
    'toolbar.new': '新規作成',
    'toolbar.open': '開く',
    'toolbar.save': '保存',
    'toolbar.save_as': '名前を付けて保存',
    'toolbar.import_psd': 'PSDインポート',
    'toolbar.atlas': 'テクスチャアトラス',
    'toolbar.undo': '元に戻す',
    'toolbar.redo': 'やり直し',
    'toolbar.commands': 'コマンドパレット',
    'toolbar.language': '言語',
    'toolbar.lang_auto': '自動 (システム言語)',
    'toolbar.lang_zh': '简体中文',
    'toolbar.lang_ja': '日本語',
    'toolbar.lang_en': 'English',

    // Hierarchy Panel
    'hierarchy.title': 'パーツ階層ツリー',
    'hierarchy.warp': 'ワープデフォーマ',
    'hierarchy.rot': '回転デフォーマ',
    'hierarchy.part': 'パーツフォルダ',
    'hierarchy.path': 'アートパス',
    'hierarchy.cleanup': '空ノードと未使用パラメータの削除',
    'hierarchy.filter_placeholder': 'ノード検索 (Ctrl+F)...',
    'hierarchy.no_nodes': 'ノードがありません',
    'hierarchy.click_add': '上の + ボタンをクリックするか、PSDファイルをインポートしてください',
    'hierarchy.visible_on': '表示',
    'hierarchy.visible_off': '非表示',
    'hierarchy.lock_on': 'ロック中',
    'hierarchy.lock_off': 'ロック解除',

    // Viewport Panel
    'viewport.title': 'ビューポート',
    'viewport.tool_select': '選択ツール',
    'viewport.tool_add_vertex': '頂点追加',
    'viewport.tool_delete_vertex': '頂点削除',
    'viewport.mesh_edit': 'メッシュ手動編集',
    'viewport.wireframe': 'ワイヤーフレーム',
    'viewport.onion_skin': 'オニオンスキン',
    'viewport.motion_path': 'モーションパス',
    'viewport.auto_idle': '自動呼吸',
    'viewport.physics': 'リアルタイム物理演算',
    'viewport.reset_camera': 'カメラリセット',
    'viewport.selected_vertex': '選択頂点',
    'viewport.grid_snap': 'グリッド吸着',

    // Parameters Panel
    'parameters.title': 'パラメータ',
    'parameters.reset_all': 'すべてデフォルトに戻す',
    'parameters.add_group': 'グループ作成',
    'parameters.preset': '標準パラメータプリセット',
    'parameters.add_param': 'パラメータ追加',
    'parameters.no_params': 'パラメータがありません。+ ボタンで追加してください。',
    'parameters.no_params_in_group': 'グループ内にパラメータがありません',
    'parameters.lock_param': 'パラメータをロック',
    'parameters.unlock_param': 'パラメータのロック解除',
    'parameters.keyform_dot': 'キーフォーム位置',
    'parameters.xy_pad': '2Dコントローラー (XY Pad)',
    'parameters.xy_pad_reset': 'ダブルクリックでリセット',
    'parameters.filter_placeholder': 'パラメータ検索 (Ctrl+F)...',

    // Inspector Panel
    'inspector.title': 'インスペクタ',
    'inspector.canvas_props': 'キャンバス設定',
    'inspector.width': '幅 (px)',
    'inspector.height': '高さ (px)',
    'inspector.node_id': 'ノードID',
    'inspector.node_name': '名称',
    'inspector.quick_setup': 'キーフォーム簡単作成',
    'inspector.key2': '+ 2キー (0, 1)',
    'inspector.key3': '+ 3キー (-30, 0, 30)',
    'inspector.synthesize_corners': '四隅形状の自動生成 (Ctrl+4)',
    'inspector.restore_shape': '元の形状に戻す',
    'inspector.shape_copy_paste': '形状のコピー / 貼り付け',
    'inspector.copy_shape': '形状をコピー',
    'inspector.paste_mirrored': '反転して反対キーに貼り付け',
    'inspector.part_folder': 'パーツプロパティ',
    'inspector.folder_opacity': 'フォルダ不透明度',
    'inspector.warp_grid': 'ワープ分割数',
    'inspector.cols': '分割数 (X)',
    'inspector.rows': '分割数 (Y)',
    'inspector.auto_turn_xy': '顔の向き自動生成 (3x3)',
    'inspector.auto_sway': '揺れの自動生成',
    'inspector.delete_bake': 'デフォーマ削除して子に焼き付け',
    'inspector.rot_deformer': '回転デフォーマ',
    'inspector.origin_x': '中心 X',
    'inspector.origin_y': '中心 Y',
    'inspector.angle': '角度 (deg)',
    'inspector.mesh_geo': 'メッシュ構造',
    'inspector.vertices': '頂点数',
    'inspector.triangles': 'ポリゴン数',
    'inspector.opacity': '不透明度',
    'inspector.hit_area': '当たり判定 (Hit Area)',
    'inspector.user_data': 'ユーザーデータ (User Data)',
    'inspector.morph_targets': 'ブレンドシェイプ (BlendShapes)',
    'inspector.add_morph': '+ 新規ブレンドシェイプ',
    'inspector.reverse_winding': 'ポリゴン表裏反転',
    'inspector.create_enclosing_warp': '包囲ワープデフォーマ作成',
    'inspector.fit_contour_path': '輪郭アートパス生成',
    'inspector.artpath_stroke': 'アートパス描線',
    'inspector.control_points': '制御点',
    'inspector.closed': '閉じた線',
    'inspector.open': '開いた線',
    'inspector.thicken': '+ 線を太く',
    'inspector.thin': '- 線を細く',

    // Timeline Panel
    'timeline.title': 'タイムライン (Timeline)',
    'timeline.play': '再生',
    'timeline.pause': '一時停止',
    'timeline.fps': 'フレームレート (FPS)',
    'timeline.duration': '総フレーム数',
    'timeline.loop': 'ループ再生',
    'timeline.auto_smooth': '自動スムージング',
    'timeline.lipsync': '音声リップシンク',
    'timeline.export_video': '動画書き出し (MP4/WebM)',
    'timeline.no_tracks': 'トラックがありません。パラメータを動かすかリップシンクを実行してください。',

    // Physics Panel
    'physics.title': '物理演算設定 (Physics)',
    'physics.presets': '物理プリセット',
    'physics.preset_hair_short': '短い髪',
    'physics.preset_hair_long': '長い髪',
    'physics.preset_skirt': 'スカート',
    'physics.preset_ribbon': 'リボン/紐',
    'physics.add_group': '物理グループ作成',
    'physics.inputs': '入力パラメータ (影響元)',
    'physics.outputs': '出力パラメータ (揺れ先)',
    'physics.pendulums': '振り子モデル',
    'physics.add_pendulum': '+ 振り子節追加',
    'physics.length': '長さ',
    'physics.damping': '収束',
    'physics.mass': '重さ',
    'physics.ground_y': '地面判定 (Y)',
    'physics.max_radius': '最大可動半径',
    'physics.bake_physics': '物理演算をタイムラインに焼き付け',
    'physics.no_groups': '物理設定がありません。上のプリセットまたは + ボタンで追加してください。',

    // History Panel
    'history.title': 'ヒストリー (Undo Tree)',
    'history.initial_state': '初期状態',
    'history.step': 'ステップ',
    'history.no_history': '変更履歴はありません。操作コマンドがここに記録されます。',

    // Atlas Modal
    'atlas.title': 'テクスチャアトラス配置',
    'atlas.size': 'アトラスサイズ (px)',
    'atlas.padding': '余白 (Padding)',
    'atlas.pack_button': '自動配置を再計算',
    'atlas.generating': '2Dシェルフ配置とUV再マッピングを計算中...',
    'atlas.sheets_count': '生成テクスチャ枚数',
    'atlas.remap_notice': '適用すると各メッシュのUVがアトラス座標に再マッピングされ textures/ に保存されます。',
    'atlas.apply_button': 'テクスチャアトラスを適用して保存',

    // Command Palette
    'palette.placeholder': 'コマンド名またはショートカットを入力 (例: Export, 4-Corner)...',
    'palette.no_results': '一致するコマンドがありません',
    'palette.group_file': 'ファイルと素材',
    'palette.group_edit': '編集',
    'palette.group_macro': '自動化マクロ',
    'palette.group_view': '表示とビュー',
    'palette.group_export': '書き出しと配布',

    // Notifications
    'notify.new_project': '新規プロジェクトを作成しました',
    'notify.saved': 'プロジェクトを保存しました',
    'notify.save_failed': 'プロジェクトの保存に失敗しました',
    'notify.opened': 'プロジェクトを開きました',
    'notify.psd_imported': 'PSDファイルを読み込みメッシュを生成しました',
    'notify.undo': '元に戻しました',
    'notify.redo': 'やり直しました',
    'notify.cleaned_empty': '空パーツ・未使用パラメータを整理しました',
    'notify.synthesized_corners': '四隅形状の自動生成が完了しました (Ctrl+4)',
    'notify.setup_turn_xy': '3x3 顔の向き空間を作成しました',
    'notify.auto_sway': '揺れモーションと物理演算を自動生成しました',
    'notify.lang_changed': '言語設定を変更しました',
  },
  'en': {
    // Toolbar & App
    'app.title': 'L2DEditor',
    'toolbar.new': 'New',
    'toolbar.open': 'Open',
    'toolbar.save': 'Save',
    'toolbar.save_as': 'Save As',
    'toolbar.import_psd': 'Import PSD',
    'toolbar.atlas': 'Atlas',
    'toolbar.undo': 'Undo',
    'toolbar.redo': 'Redo',
    'toolbar.commands': 'Commands',
    'toolbar.language': 'Language',
    'toolbar.lang_auto': 'Auto (System)',
    'toolbar.lang_zh': '简体中文',
    'toolbar.lang_ja': '日本語',
    'toolbar.lang_en': 'English',

    // Hierarchy Panel
    'hierarchy.title': 'Hierarchy',
    'hierarchy.warp': 'Warp',
    'hierarchy.rot': 'Rot',
    'hierarchy.part': 'Part',
    'hierarchy.path': 'Path',
    'hierarchy.cleanup': 'Clean empty nodes & unused params',
    'hierarchy.filter_placeholder': 'Filter nodes (Ctrl+F)...',
    'hierarchy.no_nodes': 'No nodes yet.',
    'hierarchy.click_add': 'Click + buttons above or Import PSD.',
    'hierarchy.visible_on': 'Visible',
    'hierarchy.visible_off': 'Hidden',
    'hierarchy.lock_on': 'Locked',
    'hierarchy.lock_off': 'Unlocked',

    // Viewport Panel
    'viewport.title': 'Viewport',
    'viewport.tool_select': 'Select Tool',
    'viewport.tool_add_vertex': 'Add Vertex',
    'viewport.tool_delete_vertex': 'Delete Vertex',
    'viewport.mesh_edit': 'Mesh Edit',
    'viewport.wireframe': 'Wireframe',
    'viewport.onion_skin': 'Onion Skin',
    'viewport.motion_path': 'Motion Path',
    'viewport.auto_idle': 'Auto Idle',
    'viewport.physics': 'Physics',
    'viewport.reset_camera': 'Reset Camera',
    'viewport.selected_vertex': 'Selected Vertex',
    'viewport.grid_snap': 'Grid Snap',

    // Parameters Panel
    'parameters.title': 'Parameters',
    'parameters.reset_all': 'Reset All',
    'parameters.add_group': 'Group',
    'parameters.preset': '+ Preset',
    'parameters.add_param': 'Add',
    'parameters.no_params': 'No parameters. Click + Add to create one.',
    'parameters.no_params_in_group': 'No parameters in this group',
    'parameters.lock_param': 'Lock Parameter',
    'parameters.unlock_param': 'Unlock Parameter',
    'parameters.keyform_dot': 'Keyform position',
    'parameters.xy_pad': '2D Joystick Pad (XY)',
    'parameters.xy_pad_reset': 'Double-click to reset',
    'parameters.filter_placeholder': 'Filter parameters (Ctrl+F)...',

    // Inspector Panel
    'inspector.title': 'Inspector',
    'inspector.canvas_props': 'Canvas Properties',
    'inspector.width': 'Width (px)',
    'inspector.height': 'Height (px)',
    'inspector.node_id': 'ID',
    'inspector.node_name': 'Name',
    'inspector.quick_setup': 'Keyform Quick Setup',
    'inspector.key2': '+ 2 Keys (0, 1)',
    'inspector.key3': '+ 3 Keys (-30, 0, 30)',
    'inspector.synthesize_corners': '4-Corner Blend (Ctrl+4)',
    'inspector.restore_shape': 'Restore Shape',
    'inspector.shape_copy_paste': 'Keyform Shape Copy/Paste',
    'inspector.copy_shape': 'Copy Shape',
    'inspector.paste_mirrored': 'Paste Mirrored',
    'inspector.part_folder': 'Part Folder',
    'inspector.folder_opacity': 'Folder Opacity (Cascading)',
    'inspector.warp_grid': 'Warp Grid',
    'inspector.cols': 'Columns',
    'inspector.rows': 'Rows',
    'inspector.auto_turn_xy': 'Auto Setup Turn XY (3x3)',
    'inspector.auto_sway': 'Auto Sway (AI)',
    'inspector.delete_bake': 'Delete & Bake to Children',
    'inspector.rot_deformer': 'Rotation Deformer',
    'inspector.origin_x': 'Origin X',
    'inspector.origin_y': 'Origin Y',
    'inspector.angle': 'Angle (deg)',
    'inspector.mesh_geo': 'Mesh Geometry',
    'inspector.vertices': 'Vertices',
    'inspector.triangles': 'Triangles',
    'inspector.opacity': 'Opacity',
    'inspector.hit_area': 'Hit Area Tag',
    'inspector.user_data': 'User Data',
    'inspector.morph_targets': 'Morph Targets (BlendShapes)',
    'inspector.add_morph': '+ Morph',
    'inspector.reverse_winding': 'Reverse Triangle Winding',
    'inspector.create_enclosing_warp': 'Create Enclosing Warp Deformer',
    'inspector.fit_contour_path': 'Fit Contour ArtPath',
    'inspector.artpath_stroke': 'ArtPath Stroke',
    'inspector.control_points': 'Control Points',
    'inspector.closed': 'Closed',
    'inspector.open': 'Open',
    'inspector.thicken': '+ Thicken Stroke',
    'inspector.thin': '- Thin Stroke',

    // Timeline Panel
    'timeline.title': 'Timeline & Animator',
    'timeline.play': 'Play',
    'timeline.pause': 'Pause',
    'timeline.fps': 'FPS',
    'timeline.duration': 'Duration (frames)',
    'timeline.loop': 'Loop Playback',
    'timeline.auto_smooth': 'Auto Smooth Tangents',
    'timeline.lipsync': 'Audio LipSync',
    'timeline.export_video': 'Export Video',
    'timeline.no_tracks': 'No animation tracks. Adjust parameters or run LipSync.',

    // Physics Panel
    'physics.title': 'Physics',
    'physics.presets': 'Physics Presets',
    'physics.preset_hair_short': 'Short Hair',
    'physics.preset_hair_long': 'Long Hair',
    'physics.preset_skirt': 'Skirt',
    'physics.preset_ribbon': 'Ribbon',
    'physics.add_group': 'Add Group',
    'physics.inputs': 'Inputs (Force)',
    'physics.outputs': 'Outputs (Target)',
    'physics.pendulums': 'Pendulum Chain',
    'physics.add_pendulum': '+ Add Pendulum',
    'physics.length': 'Length',
    'physics.damping': 'Damping',
    'physics.mass': 'Mass',
    'physics.ground_y': 'Ground Clamping Line (Y)',
    'physics.max_radius': 'Max Radius',
    'physics.bake_physics': 'Bake Physics to Animation Tracks',
    'physics.no_groups': 'No physics groups. Click presets above or + Add Group.',

    // History Panel
    'history.title': 'History',
    'history.initial_state': 'Initial Project State',
    'history.step': 'Step',
    'history.no_history': 'No history yet. All command bus actions will be recorded here.',

    // Atlas Modal
    'atlas.title': 'Texture Atlas',
    'atlas.size': 'Atlas Size (px)',
    'atlas.padding': 'Padding (px)',
    'atlas.pack_button': 'Pack Atlas',
    'atlas.generating': 'Computing 2D Shelf packing and UV remapping...',
    'atlas.sheets_count': 'Atlas Sheets',
    'atlas.remap_notice': 'Applying will remap mesh UVs and save PNGs into textures/.',
    'atlas.apply_button': 'Apply Atlas & Save',

    // Command Palette
    'palette.placeholder': 'Type a command or shortcut (e.g. Export, 4-Corner, Turn XY)...',
    'palette.no_results': 'No matching commands found',
    'palette.group_file': 'Project & Assets',
    'palette.group_edit': 'Edit Operations',
    'palette.group_macro': 'Rigging Macros',
    'palette.group_view': 'View & Display',
    'palette.group_export': 'Distribution & Export',

    // Notifications
    'notify.new_project': 'Created new blank project',
    'notify.saved': 'Saved project',
    'notify.save_failed': 'Failed to save project',
    'notify.opened': 'Opened project',
    'notify.psd_imported': 'Imported PSD artwork and generated triangles',
    'notify.undo': 'Undo',
    'notify.redo': 'Redo',
    'notify.cleaned_empty': 'Cleaned up empty Parts, Deformers & unused Parameters',
    'notify.synthesized_corners': 'Synthesized 4-corner keyforms (Ctrl+4)',
    'notify.setup_turn_xy': 'Applied 3x3 Turn XY Macro',
    'notify.auto_sway': 'Generated Auto Sway & Physics',
    'notify.lang_changed': 'Language changed',
  },
};

interface I18nContextValue {
  localeSetting: LanguageSetting;
  effectiveLanguage: SupportedLanguage;
  setLanguageSetting: (setting: LanguageSetting) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  localeSetting: 'auto',
  effectiveLanguage: 'en',
  setLanguageSetting: () => {},
  t: (k, fb) => fb || k,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localeSetting, setLocaleSettingState] = useState<LanguageSetting>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('l2d_language') as LanguageSetting;
      if (saved && ['auto', 'zh-CN', 'ja', 'en'].includes(saved)) {
        return saved;
      }
    }
    return 'auto';
  });

  const [systemLocale, setSystemLocale] = useState<string>('');

  // Detect system locale from Electron preload IPC or browser navigator
  useEffect(() => {
    const detect = async () => {
      if (typeof window !== 'undefined' && (window as any).l2dApi?.getSystemLocale) {
        try {
          const loc = await (window as any).l2dApi.getSystemLocale();
          if (loc) {
            setSystemLocale(loc);
            return;
          }
        } catch (e) {
          // fallback
        }
      }
      if (typeof navigator !== 'undefined') {
        setSystemLocale(navigator.language || '');
      }
    };
    detect();
  }, []);

  const effectiveLanguage = useMemo<SupportedLanguage>(() => {
    if (localeSetting === 'auto') {
      return detectSystemLanguage(systemLocale);
    }
    return localeSetting;
  }, [localeSetting, systemLocale]);

  const setLanguageSetting = (setting: LanguageSetting) => {
    setLocaleSettingState(setting);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('l2d_language', setting);
    }
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[effectiveLanguage];
    if (dict && dict[key]) {
      return dict[key];
    }
    // Fallback to English dictionary
    const enDict = translations['en'];
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback || key;
  };

  return (
    <I18nContext.Provider
      value={{
        localeSetting,
        effectiveLanguage,
        setLanguageSetting,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n() {
  return useContext(I18nContext);
}
