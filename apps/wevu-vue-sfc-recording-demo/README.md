# wevu-vue-sfc-recording-demo

`weapp-vite + wevu + Vue SFC` 的录屏演示项目。  
目标是录出“像真实开发一样”的流程：在 VSCode 里逐字打代码、触发智能提示、保存后右侧微信开发者工具实时更新。

## 从 0 开始录屏（Demo Time）

1. 用 VSCode 单独打开目录：`apps/wevu-vue-sfc-recording-demo`。
2. 启动开发：

```bash
pnpm dev
```

3. 保持微信开发者工具在右侧（手动打开项目，或已配置服务端口时执行 `pnpm open`）。
4. 在 VSCode 打开一个 Demo Time 场景文件：
   - `.demo/from-zero-60s.json`（60 秒快节奏）
   - `.demo/from-zero-90s.json`（90 秒标准演示）
   - `.demo/from-zero-120s.json`（120 秒讲解版）
   - `.demo/from-zero.json`（不限定总时长的基础版）
5. 执行 Demo Time 的开始命令（命令面板搜索 `Demo Time: Start`）。
6. 每次按右方向键切到下一段场景。

场景文件都包含 3 段：

- `Prepare Empty File`：打开并清空 `src/pages/index/index.vue`，然后保存。
- `Type Code From Zero`：按字符逐个插入 `.demo/content/index.from-zero.vue` 的内容，然后保存。
- `Optional Manual IntelliSense`：暂停等待你手动演示智能提示（完成后按右方向键继续）。

按时长选择建议：

- 快速演示：`.demo/from-zero-60s.json`
- 常规节奏：`.demo/from-zero-90s.json`
- 带讲解录屏：`.demo/from-zero-120s.json`

## 手动智能提示演示（推荐）

在第三段暂停时，做一段真实操作：

1. 光标放到 `import { computed, ref } from 'wevu'` 这一行。
2. 手打 `onS`，按 `Ctrl+Space` 呼出建议。
3. 用方向键选中 `onShow`，回车确认。
4. `Cmd+S`（或 `Ctrl+S`）保存，右侧微信开发者工具展示热更新。

这样录出来就是“左边真实编码 + 右边实时效果”的开发链路。

## 关键文件

- Demo Time 场景：`.demo/from-zero-60s.json`、`.demo/from-zero-90s.json`、`.demo/from-zero-120s.json`、`.demo/from-zero.json`
- 字符输入内容：`.demo/content/index.from-zero.vue`
- 演示入口页面：`src/pages/index/index.vue`
- PPT 成片导出说明：`PPT-VIDEO-WORKFLOW.md`

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
