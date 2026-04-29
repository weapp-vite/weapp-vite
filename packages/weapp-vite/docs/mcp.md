# weapp-vite MCP 集成使用指南

## 1. 能力概览

`weapp-vite` 现在内置了对 `weapp-vite/mcp` 的集成，支持直接通过 `weapp-vite mcp` 启动 MCP Server（`stdio` 传输）。

如果你是在其他仓库里通过 npm 依赖使用 `weapp-vite`，建议先让 AI 读取本地随包文档目录：

- `node_modules/weapp-vite/dist/docs/index.md`
- `node_modules/weapp-vite/dist/docs/README.md`
- `node_modules/weapp-vite/dist/docs/mcp.md`

这样可以优先命中与当前安装版本一致的本地说明，而不是依赖可能过期的外部网页或模型记忆。

这个 MCP Server 主要面向 AI 编程助手，暴露了 `weapp-vite / wevu / wevu-compiler` 的关键研发能力：

1. 工作区能力目录（版本、脚本、文档）
2. 源码文件列表、按行读取、全文检索
3. 包级脚本执行（`pnpm run`）
4. `weapp-vite` CLI 调用
5. 仓库级受限命令执行（`pnpm/node/git/rg`）
6. 面向改造和排障的标准 Prompt 模板

## 2. 快速接入客户端

如果你的目标不是“研究 MCP 地址”，而是尽快让 AI 工具开始可用，推荐直接使用下面这组命令：

### 2.1 直接生成客户端配置（推荐）

当前版本优先支持：

1. `Codex`
2. `Claude Code`
3. `Cursor`

推荐命令：

```bash
wv mcp init codex
wv mcp init claude-code
wv mcp init cursor
```

行为说明：

1. 先预览将写入的配置片段。
2. 再询问是否写入客户端配置文件。
3. 写入后提示执行 `wv mcp doctor <client>` 做检查。

只想打印配置、不写入文件时：

```bash
wv mcp print codex
wv mcp print claude-code
wv mcp print cursor
```

检查配置是否已经可用：

```bash
wv mcp doctor codex
wv mcp doctor claude-code
wv mcp doctor cursor
```

默认情况下，`init/print` 会生成“由 AI 客户端直接拉起 `wv mcp`”的命令型配置。

### 2.2 HTTP 模式接入

如果你已经通过 `pnpm dev`、`wv dev` 或手动 `wv mcp --transport streamable-http` 启动了 MCP HTTP 服务，也可以直接生成 HTTP 配置：

```bash
wv mcp init codex --transport http
wv mcp init claude-code --transport http
wv mcp init cursor --transport http
```

如果自动探测到的地址不是你要的，可以显式指定：

```bash
wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp
```

### 2.3 配置文件落点

当前默认写入位置：

1. `Codex`: `~/.codex/config.toml`
2. `Claude Code`: 项目根目录 `.mcp.json`
3. `Cursor`: 项目根目录 `.cursor/mcp.json`

`Codex` 使用受管区块写入，避免覆盖用户其他 MCP 配置；`Claude Code` 和 `Cursor` 则按项目维度写入，更适合跟仓库一起协作。

## 3. 启动方式

### 3.0 CLI 自动启动（默认关闭）

默认情况下，`weapp-vite` 不会在 CLI 启动时自动拉起 MCP 服务。
如果你希望开发命令执行时自动拉起本地 MCP HTTP 服务（`streamable-http`），可在 `vite.config.ts` 显式开启：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: {
      enabled: true,
      autoStart: true,
    },
  },
})
```

默认地址：

- `http://127.0.0.1:3088/mcp`

完全关闭 MCP：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: false,
  },
})
```

### 3.1 CLI 启动

在 monorepo 根目录或任意子目录执行：

```bash
weapp-vite mcp
```

可选指定工作区根路径：

```bash
weapp-vite mcp --workspace-root <repo-root>
```

以 HTTP 方式手动启动：

```bash
weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

说明：

1. 不传 `--workspace-root` 时，会从当前目录向上自动定位 `pnpm-workspace.yaml`。
2. `--transport stdio` 通过标准输入输出通信，不会启动 HTTP 端口。
3. `--transport streamable-http` 会启动本地 HTTP 服务，可供支持 URL 连接的 MCP Client 使用。

### 3.2 程序化启动

`weapp-vite` 暴露了 `weapp-vite/mcp` 子路径，可直接在 Node 脚本中使用。

```ts
import { startWeappViteMcpServer } from 'weapp-vite/mcp'

await startWeappViteMcpServer({
  workspaceRoot: process.cwd(),
})
```

如果你需要自定义生命周期，继续通过 `weapp-vite/mcp` 即可：

```ts
import { startStdioServer } from 'weapp-vite/mcp'

await startStdioServer({
  workspaceRoot: process.cwd(),
})
```

如果你需要手动控制 `stdio` / `streamable-http` 两种 transport，也可以直接调用：

```ts
import { startWeappViteMcpServer } from 'weapp-vite/mcp'

const handle = await startWeappViteMcpServer({
  workspaceRoot: process.cwd(),
  transport: 'streamable-http',
  host: '127.0.0.1',
  port: 3088,
  endpoint: '/mcp',
})

await handle.close?.()
```

## 4. 客户端接入示例

以下是通用的 MCP Client `stdio` 配置示例。通常优先使用 `wv mcp init <client>` 自动生成，不再建议手写：

```json
{
  "mcpServers": {
    "weapp-vite": {
      "command": "weapp-vite",
      "args": [
        "mcp",
        "--workspace-root",
        "<repo-root>"
      ]
    }
  }
}
```

如果你是仓库开发者，也可以直接指向本地脚本命令（例如 `pnpm` 脚本）来启动同一服务。

## 5. 可用 Tools

1. `workspace_catalog`
2. `list_source_files`
3. `read_source_file`
4. `search_source_code`
5. `run_package_script`
6. `run_weapp_vite_cli`
7. `run_repo_command`
8. `take_weapp_screenshot`
9. `compare_weapp_screenshot`
10. `weapp_devtools_connect`
11. `weapp_devtools_route`
12. `weapp_devtools_active_page`
13. `weapp_devtools_page_stack`
14. `weapp_devtools_capture`
15. `weapp_devtools_host_api`
16. `weapp_devtools_console`
17. `weapp_runtime_find_node` / `weapp_runtime_find_nodes` / `weapp_runtime_wait_node`
18. `weapp_runtime_wait`
19. `weapp_runtime_page_state` / `weapp_runtime_update_page_state` / `weapp_runtime_invoke_page`
20. `weapp_runtime_tap_node` / `weapp_runtime_input_node`
21. `weapp_runtime_component_state` / `weapp_runtime_update_component_state` / `weapp_runtime_invoke_component`
22. `weapp_runtime_find_child` / `weapp_runtime_find_children`
23. `weapp_runtime_node_markup` / `weapp_runtime_node_styles` / `weapp_runtime_node_attrs` / `weapp_runtime_scroll_node` / `weapp_runtime_measure_node`

建议使用顺序：

1. 先调用 `workspace_catalog` 获取可操作包与脚本。
2. 再用 `search_source_code` / `read_source_file` 做定位。
3. 最后用 `run_package_script` 或 `run_repo_command` 做验证。

## 6. 可用 Resources

1. `weapp-vite://workspace/catalog`
2. `weapp-vite://docs/{package}/README.md`
3. `weapp-vite://docs/{package}/CHANGELOG.md`
4. `weapp-vite://source/{package}?path={path}`

`{package}` 目前支持：

1. `weapp-vite`
2. `wevu`
3. `wevu-compiler`

## 7. 可用 Prompts

1. `plan-weapp-vite-change`
2. `debug-wevu-runtime`
3. `inspect-mini-program-page`
4. `recover-mini-program-connection`

典型用途：

1. 需求改造前先生成实施计划。
2. `wevu` 生命周期或响应式问题排查时快速建立诊断框架。

## 8. 安全边界与限制

MCP 服务端做了以下约束：

1. 文件访问限制在工作区根目录内，阻止路径越界。
2. 命令执行限制在白名单：`pnpm/node/git/rg`。
3. 命令与文件读取有输出截断与超时控制，避免上下文爆炸。

建议在 CI 或团队环境中继续加上外层沙箱策略（容器、只读挂载、命令审计）。

## 9. AI 直达工具

除了通用的 `run_weapp_vite_cli`，MCP 还提供了更适合 AI 直接命中的显式工具：

1. `take_weapp_screenshot`
   - 用于“小程序截图 / 页面快照 / runtime screenshot”语义
   - 等价于执行 `weapp-vite screenshot --json ...`
2. `compare_weapp_screenshot`
   - 用于“截图对比 / diff / baseline / 视觉回归 / 像素对比”语义
   - 等价于执行 `weapp-vite compare --json ...`

推荐让 AI 优先选择这两个显式工具，而不是先拼通用 CLI 参数。这样命中率和结果一致性会更高。

## 10. 故障排查

1. `wv mcp init <client>` 写入失败：先确认目标配置文件可写。
2. `wv mcp doctor <client>` 失败：优先看配置文件里是否已经生成 `weapp-vite-*` server 条目。
3. `weapp-vite mcp` 启动失败：确认 Node 版本符合 `^20.19.0 || >=22.12.0`。
4. AI 看不到包内容：检查 `--workspace-root` 是否指向正确仓库根目录。
5. 命令执行失败：确认命令在白名单中，并检查子目录权限与脚本名是否存在。

## 11. 示例：AI 驱动 weapp-vite screenshot 验收

下面给一个简化版示例：只给 AI 一段提示词，让它通过 MCP 自动执行构建与截图验收。

前置条件：

1. 客户端已接入 `weapp-vite` MCP。
2. 微信开发者工具已登录，并开启「设置 -> 安全设置 -> 服务端口」。

### 11.1 可直接复制的提示词

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图验收：
1. 先阅读 node_modules/weapp-vite/dist/docs/index.md 和 node_modules/weapp-vite/dist/docs/mcp.md，确认当前版本的本地说明。
2. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
3. 执行 weapp-vite screenshot，参数如下：
   - project: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - output: .tmp/mcp-screenshot.png
   - 使用 --json 返回结果
4. 检查 .tmp/mcp-screenshot.png 是否存在：
   - 存在输出 screenshot-ok
   - 不存在输出 screenshot-missing
5. 最后汇总：执行命令、关键输出、最终结论。
```

### 11.2 期望结果

1. AI 输出 `screenshot-ok`。
2. 工作区生成 `.tmp/mcp-screenshot.png`。
3. AI 输出本次验收摘要（命令、关键日志、结论）。

## 12. 示例：AI 驱动 screenshot compare 验收

如果提示词里出现“截图对比 / baseline / diff / 视觉回归”，应优先让 AI 使用 `compare_weapp_screenshot`，或退回到 `weapp-vite compare`。

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图对比验收：
1. 先阅读 node_modules/weapp-vite/dist/docs/index.md、node_modules/weapp-vite/dist/docs/ai-workflows.md 和 node_modules/weapp-vite/dist/docs/mcp.md。
2. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
3. 执行截图对比：
   - projectPath: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - baselinePath: .screenshots/baseline/home.png
   - diffOutputPath: .tmp/mcp-home.diff.png
   - maxDiffPixels: 100
4. 如果命令通过，输出 compare-ok；如果对比失败，输出 compare-failed。
5. 最后汇总：执行命令、关键输出、最终结论。
```
