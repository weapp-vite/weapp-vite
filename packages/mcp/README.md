# @weapp-vite/mcp

## 简介

`@weapp-vite/mcp` 是面向 `weapp-vite` / `wevu` monorepo 的 MCP 服务端实现，目标是把核心研发能力暴露给 AI：

- 包目录与能力发现
- 源码读取、检索、按行裁剪
- 包级脚本执行
- `weapp-vite` CLI 执行
- 文档/变更记录资源暴露
- 调试/改造提示词模板

默认通过 `stdio` 运行，适合接入任意 MCP Client，也支持 `streamable-http`。

## 启动

```bash
pnpm --filter @weapp-vite/mcp start
```

也可以在 Node 脚本里直接调用：

```ts
import { startWeappViteMcpServer } from '@weapp-vite/mcp'

const handle = await startWeappViteMcpServer({
  workspaceRoot: process.cwd(),
  transport: 'streamable-http',
  host: '127.0.0.1',
  port: 3088,
  endpoint: '/mcp',
})

await handle.close?.()
```

## 主要 Tools

- `workspace_catalog`: 输出 `weapp-vite / wevu / wevu-compiler` 目录、版本、脚本
- `list_source_files`: 列出包内文件（默认 `src`）
- `read_source_file`: 读取包内文件，支持 `startLine/endLine/maxChars`
- `search_source_code`: 在包源码中检索关键词
- `run_package_script`: 在指定包目录执行 `pnpm run <script>`
- `run_weapp_vite_cli`: 执行 `node packages/weapp-vite/bin/weapp-vite.js ...`
- `take_weapp_screenshot`: 面向“小程序截图 / 页面快照”语义，执行 `weapp-vite screenshot --json`
- `compare_weapp_screenshot`: 面向“截图对比 / diff / baseline / 视觉回归”语义，执行 `weapp-vite compare --json`
- `run_repo_command`: 执行仓库级命令（`pnpm/node/git/rg`）

### DevTools Runtime Tools

这些工具复用 `weapp-ide-cli` 的 automator 会话能力，面向已经能被微信开发者工具打开的小程序项目：

- `weapp_devtools_connect`: 确认 DevTools automator 会话可用
- `weapp_devtools_active_page` / `weapp_devtools_page_stack`: 读取当前页面与页面栈
- `weapp_devtools_route`: 执行 `navigateTo` / `redirectTo` / `reLaunch` / `switchTab` / `navigateBack`
- `weapp_devtools_capture`: 截取当前小程序视口
- `weapp_devtools_host_api`: 调用 `wx.*` API
- `weapp_devtools_console`: 读取 MCP 会话期间捕获的 console/exception 日志
- `weapp_runtime_find_node` / `weapp_runtime_find_nodes` / `weapp_runtime_wait_node`: 查询和等待页面元素
- `weapp_runtime_page_state` / `weapp_runtime_update_page_state` / `weapp_runtime_invoke_page`: 操作页面实例
- `weapp_runtime_tap_node` / `weapp_runtime_input_node`: 操作页面元素
- `weapp_runtime_component_state` / `weapp_runtime_update_component_state` / `weapp_runtime_invoke_component`: 操作组件实例
- `weapp_runtime_find_child` / `weapp_runtime_find_children`: 查询组件内部元素
- `weapp_runtime_node_markup` / `weapp_runtime_node_styles` / `weapp_runtime_node_attrs` / `weapp_runtime_measure_node`: 读取元素结构与渲染信息

建议调用顺序：先 `weapp_devtools_connect`，再 `weapp_devtools_active_page`，之后再执行 `weapp_devtools_capture` 或 `weapp_runtime_*`。

## 主要 Resources

- `weapp-vite://workspace/catalog`
- `weapp-vite://docs/{package}/README.md`
- `weapp-vite://docs/{package}/CHANGELOG.md`
- `weapp-vite://source/{package}?path={path}`

其中 `{package}` 支持：

- `weapp-vite`
- `wevu`
- `wevu-compiler`

## Prompts

- `plan-weapp-vite-change`: 生成 weapp-vite/wevu 改造计划提示词
- `debug-wevu-runtime`: 生成 wevu runtime 排查提示词
- `inspect-mini-program-page`: 连接 DevTools 并检查页面渲染状态
- `recover-mini-program-connection`: 按固定顺序恢复 automator 连接

## 开发

```bash
pnpm --filter @weapp-vite/mcp test
pnpm --filter @weapp-vite/mcp build
```

## 相关链接

- MCP SDK: https://github.com/modelcontextprotocol/sdk
- 仓库: https://github.com/weapp-vite/weapp-vite
