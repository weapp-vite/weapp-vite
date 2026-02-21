# wevu-vue-sfc-recording-demo

`weapp-vite + wevu + Vue SFC` 的录屏演示项目，专门用于在 VSCode 中录制“像真实开发一样写代码”的视频，并在 PPT 中播放。

## 快速开始

```bash
pnpm -C apps/wevu-vue-sfc-recording-demo dev
```

为了直接应用录屏专用编辑器配置，建议单独用 VSCode 打开目录：`apps/wevu-vue-sfc-recording-demo`。

常用命令：

```bash
# 切回录屏起始代码（更适合从头手打）
pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset

# 切回录屏目标代码（用于演示完成态）
pnpm -C apps/wevu-vue-sfc-recording-demo demo:final

# 90 秒录屏专用：切到起始态
pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset:90s

# 90 秒录屏专用：切到完成态
pnpm -C apps/wevu-vue-sfc-recording-demo demo:final:90s

# 120 秒录屏专用：切到起始态
pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset:120s

# 120 秒录屏专用：切到完成态
pnpm -C apps/wevu-vue-sfc-recording-demo demo:final:120s

# 录屏成片导出（PPT 友好 mp4）
pnpm -C apps/wevu-vue-sfc-recording-demo video:prepare -- ./recordings/raw-demo.mp4

# 类型检查
pnpm -C apps/wevu-vue-sfc-recording-demo typecheck

# 构建
pnpm -C apps/wevu-vue-sfc-recording-demo build
```

## 录屏流程（VSCode 手打 + 智能提示）

1. 打开 `apps/wevu-vue-sfc-recording-demo/src/pages/index/index.vue`。
2. 执行 `demo:reset`，先进入起始态。
3. 开始录屏后，按下面节奏演示：

- 在 `import { ref } from 'wevu'` 处手动补 `computed, onShow, watch`，让补全下拉出现并回车选中。
- 把 `definePageJson` 标题从 `录屏起始态` 改成 `wevu Vue SFC 录屏 Demo`。
- 增加 `features`、`finishedCount`、`progressText`、`toggle`、`reset` 等逻辑。
- 在 `<template>` 增加 `v-for` 列表和 `@tap` 事件。
- `Cmd+S` 保存，展示右侧/模拟器热更新。

4. 如果一遍录不满意，重复执行 `demo:reset` 再录。

参考目标代码：`src/pages/index/index.recording-final.vue`。
90 秒台本：`RECORDING-90S.md`。
120 秒台本：`RECORDING-120S.md`。
PPT 成片流程：`PPT-VIDEO-WORKFLOW.md`。

注意：所有 `demo:*` 场景命令都会覆盖 `src/pages/index/index.vue`，请顺序执行，不要并发执行。

## 推荐 VSCode 临时设置（录屏时）

```json
{
  "editor.fontSize": 24,
  "editor.lineHeight": 1.65,
  "editor.cursorBlinking": "solid",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.minimap.enabled": false,
  "editor.suggestSelection": "first",
  "editor.quickSuggestions": {
    "other": true,
    "comments": false,
    "strings": true
  },
  "editor.inlineSuggest.enabled": true,
  "editor.acceptSuggestionOnEnter": "smart",
  "files.autoSave": "off"
}
```

## OBS 录制参数（PPT 友好）

- 画布和输出分辨率：`1920x1080`
- 帧率：`30`
- 输出格式：`mp4`
- 视频编码：`H.264`
- 码率：`10,000 ~ 16,000 Kbps`
- 录制窗口：只裁剪 VSCode 编辑区 + 一小块终端/模拟器，避免视觉噪音
