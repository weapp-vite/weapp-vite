# AI Workflows

这个文档面向在其他仓库里使用 `weapp-vite` 的 AI 代理。

## 首选信息源

当项目已经安装了 `weapp-vite` 时，优先读取本地随包文档，而不是先看网站旧内容：

1. `node_modules/weapp-vite/dist/docs/index.md`
2. `node_modules/weapp-vite/dist/docs/README.md`
3. `node_modules/weapp-vite/dist/docs/getting-started.md`
4. `node_modules/weapp-vite/dist/docs/weapp-config.md`
5. 按需继续阅读 `wevu-authoring.md`、`vue-sfc.md`、`troubleshooting.md`

## 项目级约束

如果项目由 `create-weapp-vite` 创建，根目录通常会有 `AGENTS.md`。

应把它视为项目工作流契约，而不是可忽略的模板文件。优先同时遵守：

1. 项目根 `AGENTS.md`
2. `node_modules/weapp-vite/dist/docs/*.md`
3. 当前仓库实际代码与 `vite.config.ts`

## 常用 AI 命令

CLI 同时支持完整命令 `weapp-vite` 与简写命令 `wv`，两者等价。

常见工作流：

```bash
weapp-vite prepare
weapp-vite dev --open
weapp-vite build
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
weapp-vite compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
weapp-vite ide logs --open
weapp-vite mcp
weapp-vite mcp init codex
weapp-vite mcp doctor codex
```

等价写法：

```bash
wv prepare
wv dev --open
wv build
wv screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
wv compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
wv ide logs --open
wv mcp
wv mcp init codex
wv mcp doctor codex
```

`wv mcp` 既可以启动服务，也可以管理 AI 客户端配置：

- `wv mcp init <codex|claude-code|cursor>`：写入客户端配置。
- `wv mcp print <codex|claude-code|cursor>`：只打印配置预览。
- `wv mcp doctor <codex|claude-code|cursor>`：检查配置。
- `wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp`：为已启动的 HTTP MCP 服务生成客户端配置。

当 MCP 客户端已经接入后，优先使用这些真实小程序运行时工具：

- `take_weapp_screenshot` / `compare_weapp_screenshot`：截图与截图对比。
- `weapp_devtools_connect` / `weapp_devtools_route` / `weapp_devtools_capture` / `weapp_devtools_console`：连接 DevTools、切路由、截图、读日志。
- `weapp_runtime_find_node` / `weapp_runtime_page_state` / `weapp_runtime_component_state`：检查页面结构、页面 data 与组件 data。

提示词可以直接点名 `inspect-mini-program-page` 或 `recover-mini-program-connection`，让 AI 按固定顺序检查页面或恢复 automator 连接。

## 截图与日志

- 小程序截图采集优先使用 `weapp-vite screenshot` / `wv screenshot`
- 小程序截图对比验收优先使用 `weapp-vite compare` / `wv compare`
- 不要退化成普通浏览器截图来替代小程序运行时截图
- 查看 DevTools 终端日志优先使用 `weapp-vite ide logs --open` / `wv ide logs --open`

## AI 意图映射

当用户请求包含以下意图时，AI 应直接命中对应命令，而不是先尝试泛化的浏览器工具：

- `截图`、`截个图`、`页面快照`、`运行时截图`、`capture current page`
  - 默认使用 `weapp-vite screenshot` / `wv screenshot`
- `截图对比`、`视觉回归`、`diff`、`baseline`、`像素对比`、`acceptance compare`
  - 默认使用 `weapp-vite compare` / `wv compare`
- `DevTools 日志`、`运行时日志`、`小程序 console`
  - 默认使用 `weapp-vite ide logs --open` / `wv ide logs --open`

如果目标明确是 Web runtime，而不是微信开发者工具中的小程序运行时，才改用普通浏览器截图或 Web E2E 工具。

## 原生小程序迁移路线

当用户要求迁移存量原生小程序时，先判断迁移终点：

- 路线 A：`weapp-vite + 原生`。保留 `Page/Component + WXML/WXSS/JSON`，只升级构建、TypeScript、路径别名、资源处理、DevTools、截图日志、AI 协作和 CI。
- 路线 B：`weapp-vite + wevu + Vue SFC`。在路线 A 稳定后，按新页面、低风险页面或页面族继续迁到 `.vue`、响应式状态和类型化组件契约。

不要把“接入 `weapp-vite`”自动解释为“必须引入 `wevu` 或改成 `.vue`”。如果用户只要求路线 A，迁移输出应包含原生保留区、工具链改动、验证命令和未来进入路线 B 的触发条件。

## 推荐阅读顺序

- 项目初始化、命令和 AI 使用入口：[`getting-started.md`](./getting-started.md)
- 项目目录与生成文件：[`project-structure.md`](./project-structure.md)
- `vite.config.ts` 中的 `weapp` 配置：[`weapp-config.md`](./weapp-config.md)
- wevu 页面、组件、store 写法：[`wevu-authoring.md`](./wevu-authoring.md)
- Vue SFC 宏与模板约束：[`vue-sfc.md`](./vue-sfc.md)
- 常见告警与排障：[`troubleshooting.md`](./troubleshooting.md)
