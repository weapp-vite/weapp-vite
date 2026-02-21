# wevu-vue-sfc-recording-demo

`weapp-vite + wevu + Vue SFC` 的录屏演示项目。  
目标是录出“像真实开发一样”的流程：在 VSCode 里逐字打代码、触发智能提示、保存后右侧微信开发者工具实时更新。

## 核心演示（Demo Time）

1. 用 VSCode 单独打开目录：`apps/wevu-vue-sfc-recording-demo`。
2. 启动开发：

```bash
pnpm dev
```

3. 保持微信开发者工具在右侧（手动打开项目，或已配置服务端口时执行 `pnpm open`）。
4. 在 VSCode 打开唯一场景文件：`.demo/core.json`。
5. 执行 Demo Time 的开始命令（命令面板搜索 `Demo Time: Start`）。
6. 每次按右方向键切到下一段场景。

`core.json` 包含 3 段：

- `Prepare Empty File`：打开并清空 `src/pages/index/index.vue`，然后保存。
- `Type Code From Zero`：按字符逐个插入完整页面代码并保存。
- `Optional Manual IntelliSense`：暂停等待你手动演示智能提示（完成后按右方向键继续）。

## 手动智能提示演示（推荐）

在第三段暂停时，做一段真实操作：

1. 光标放到 `import { computed, ref } from 'wevu'` 这一行。
2. 手打 `onS`，按 `Ctrl+Space` 呼出建议。
3. 用方向键选中 `onShow`，回车确认。
4. `Cmd+S`（或 `Ctrl+S`）保存，右侧微信开发者工具展示热更新。

这样录出来就是“左边真实编码 + 右边实时效果”的开发链路。

## 运行不起来时先排查

1. 在命令面板执行 `Demo Time: Start` 启动整段场景，不要只执行单个 move。
2. 运行时通过右方向键推进到下一段；如果在 `waitForInput` 停住是正常行为。
3. 打开 `输出 -> Demo Time — Presentations & Demos in VS Code`，确认有 `Running move` 日志。
4. 若出现 `Cannot read properties of undefined (reading 'update')`，先打开一次 Demo Time 侧边栏，再执行 `Developer: Reload Window` 后重试。

## 关键文件

- Demo Time 场景：`.demo/core.json`
- 演示入口页面：`src/pages/index/index.vue`
- PPT 成片导出说明：`docs/recording/wevu-vue-sfc-recording-demo/PPT-VIDEO-WORKFLOW.md`

## 常用命令

```bash
# 在本目录下运行
pnpm dev
pnpm open
pnpm typecheck
pnpm build
pnpm video:prepare -- ./recordings/raw-demo.mp4
```

## 推荐 VSCode 录屏设置

```json
{
  "editor.fontSize": 24,
  "editor.lineHeight": 1.65,
  "editor.cursorBlinking": "solid",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.minimap.enabled": false,
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
