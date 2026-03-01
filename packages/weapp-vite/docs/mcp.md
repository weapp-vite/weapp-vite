# weapp-vite MCP 集成使用指南

## 1. 能力概览

`weapp-vite` 现在内置了对 `@weapp-vite/mcp` 的集成，支持直接通过 `weapp-vite mcp` 启动 MCP Server（`stdio` 传输）。

这个 MCP Server 主要面向 AI 编程助手，暴露了 `weapp-vite / wevu / wevu-compiler` 的关键研发能力：

1. 工作区能力目录（版本、脚本、文档）
2. 源码文件列表、按行读取、全文检索
3. 包级脚本执行（`pnpm run`）
4. `weapp-vite` CLI 调用
5. 仓库级受限命令执行（`pnpm/node/git/rg`）
6. 面向改造和排障的标准 Prompt 模板

## 2. 启动方式

### 2.0 CLI 自动启动（默认关闭）

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

### 2.1 CLI 启动（推荐）

在 monorepo 根目录或任意子目录执行：

```bash
weapp-vite mcp
```

可选指定工作区根路径：

```bash
weapp-vite mcp --workspace-root /path/to/weapp-vite
```

以 HTTP 方式手动启动：

```bash
weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

说明：

1. 不传 `--workspace-root` 时，会从当前目录向上自动定位 `pnpm-workspace.yaml`。
2. `--transport stdio` 通过标准输入输出通信，不会启动 HTTP 端口。
3. `--transport streamable-http` 会启动本地 HTTP 服务，可供支持 URL 连接的 MCP Client 使用。

### 2.2 程序化启动

`weapp-vite` 暴露了 `weapp-vite/mcp` 子路径，可直接在 Node 脚本中使用。

```ts
import { startWeappViteMcpServer } from 'weapp-vite/mcp'

await startWeappViteMcpServer({
  workspaceRoot: process.cwd(),
})
```

如果你需要自定义生命周期，可以使用 `createWeappViteMcpServer`：

```ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createWeappViteMcpServer } from 'weapp-vite/mcp'

const { server } = await createWeappViteMcpServer({
  workspaceRoot: process.cwd(),
})

await server.connect(new StdioServerTransport())
```

## 3. 客户端接入示例

以下是通用的 MCP Client `stdio` 配置示例，请按你的客户端格式调整字段名：

```json
{
  "mcpServers": {
    "weapp-vite": {
      "command": "weapp-vite",
      "args": [
        "mcp",
        "--workspace-root",
        "/absolute/path/to/weapp-vite"
      ]
    }
  }
}
```

如果你是仓库开发者，也可以直接指向本地脚本命令（例如 `pnpm` 脚本）来启动同一服务。

## 4. 可用 Tools

1. `workspace_catalog`
2. `list_source_files`
3. `read_source_file`
4. `search_source_code`
5. `run_package_script`
6. `run_weapp_vite_cli`
7. `run_repo_command`

建议使用顺序：

1. 先调用 `workspace_catalog` 获取可操作包与脚本。
2. 再用 `search_source_code` / `read_source_file` 做定位。
3. 最后用 `run_package_script` 或 `run_repo_command` 做验证。

## 5. 可用 Resources

1. `weapp-vite://workspace/catalog`
2. `weapp-vite://docs/{package}/README.md`
3. `weapp-vite://docs/{package}/CHANGELOG.md`
4. `weapp-vite://source/{package}?path={path}`

`{package}` 目前支持：

1. `weapp-vite`
2. `wevu`
3. `wevu-compiler`

## 6. 可用 Prompts

1. `plan-weapp-vite-change`
2. `debug-wevu-runtime`

典型用途：

1. 需求改造前先生成实施计划。
2. `wevu` 生命周期或响应式问题排查时快速建立诊断框架。

## 7. 安全边界与限制

MCP 服务端做了以下约束：

1. 文件访问限制在工作区根目录内，阻止路径越界。
2. 命令执行限制在白名单：`pnpm/node/git/rg`。
3. 命令与文件读取有输出截断与超时控制，避免上下文爆炸。

建议在 CI 或团队环境中继续加上外层沙箱策略（容器、只读挂载、命令审计）。

## 8. 故障排查

1. `weapp-vite mcp` 启动失败：先确认 Node 版本符合 `^20.19.0 || >=22.12.0`。
2. AI 看不到包内容：检查 `--workspace-root` 是否指向正确仓库根目录。
3. 命令执行失败：确认命令在白名单中，并检查子目录权限与脚本名是否存在。

## 9. 示例：AI 驱动 weapp-vite screenshot 验收

下面给一个简化版示例：只给 AI 一段提示词，让它通过 MCP 自动执行构建与截图验收。

前置条件：

1. 客户端已接入 `weapp-vite` MCP。
2. 微信开发者工具已登录，并开启「设置 -> 安全设置 -> 服务端口」。

### 9.1 可直接复制的提示词

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图验收：
1. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
2. 执行 weapp-vite screenshot，参数如下：
   - project: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - output: .tmp/mcp-screenshot.png
   - 使用 --json 返回结果
3. 检查 .tmp/mcp-screenshot.png 是否存在：
   - 存在输出 screenshot-ok
   - 不存在输出 screenshot-missing
4. 最后汇总：执行命令、关键输出、最终结论。
```

### 9.2 期望结果

1. AI 输出 `screenshot-ok`。
2. 工作区生成 `.tmp/mcp-screenshot.png`。
3. AI 输出本次验收摘要（命令、关键日志、结论）。
