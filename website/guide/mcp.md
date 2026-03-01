---
title: MCP 与 AI 协作指南
description: 介绍 weapp-vite MCP 能力的价值、接入方式、测试方法与团队落地建议。
keywords:
  - guide
  - mcp
  - ai
  - weapp-vite
  - wevu
---

# MCP 与 AI 协作指南

`weapp-vite` 已集成 MCP 能力，可把 `weapp-vite / wevu / wevu-compiler` 的核心研发能力开放给 AI 助手（代码检索、文件读取、脚本执行、CLI 调用、文档资源读取等）。

## MCP 有什么用

典型收益：

1. 让 AI 不再“凭记忆回答”，而是直接读取当前仓库真实代码与文档。
2. 让 AI 可以执行受限命令并回传结构化结果，减少“只会给建议，不会验证”的问题。
3. 让团队形成统一的 AI 工作流：定位 -> 修改 -> 验证 -> 回归。

典型场景：

1. 排查 `wevu` 生命周期/响应式行为。
2. 修改 `weapp-vite` CLI、配置解析、编译链路并做定向测试。
3. 快速整理包级脚本、README、CHANGELOG 的上下文。

## 默认行为

`weapp-vite` 默认 **不会自动启动** MCP 服务。

如果你希望在执行 `weapp-vite dev/build` 时自动拉起本地 MCP HTTP 服务，可在 `vite.config.ts` 开启：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: {
      autoStart: true,
    },
  },
})
```

完全关闭 MCP：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: false,
  },
})
```

## 手动启动（推荐）

### 1) stdio 模式（通用）

```bash
weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite
```

适合大多数 MCP Client（Cursor/Cline/Claude Code/Codex 等）的 `command + args` 接入模式。

### 2) streamable-http 模式（URL 连接）

```bash
weapp-vite mcp \
  --transport streamable-http \
  --host 127.0.0.1 \
  --port 3088 \
  --endpoint /mcp \
  --workspace-root /absolute/path/to/weapp-vite
```

服务地址示例：`http://127.0.0.1:3088/mcp`

## AI 客户端快速接入

通用配置模板（stdio）：

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

建议团队统一一个命名（例如 `weapp-vite`），避免每个人配置名不一致导致提示词模板无法复用。

### Cursor

1. 打开 Cursor 设置，进入 MCP Servers（不同版本入口名称可能有差异）。
2. 新增一个 server，命名为 `weapp-vite`。
3. 配置启动命令：

```json
{
  "command": "weapp-vite",
  "args": [
    "mcp",
    "--workspace-root",
    "/absolute/path/to/weapp-vite"
  ]
}
```

4. 保存后重启 Chat 会话，在对话里执行一次 `tools/list`，确认出现 `workspace_catalog` 等工具。

### Claude（Claude Code / Claude Desktop）

1. 打开 Claude 的 MCP 配置入口（CLI 配置或桌面端 Developer 设置中的 MCP）。
2. 添加 `weapp-vite` 服务，复用上面的 `command + args`。
3. 若客户端要求 JSON 结构，可直接使用：

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

4. 重启 Claude 会话后，先让 AI 执行 `workspace_catalog`，确认能读取仓库目录与包信息。

### Cline（VS Code）

1. 在 VS Code 安装并启用 Cline。
2. 打开命令面板执行 `Cline: Open MCP Settings`。
3. 在配置文件中添加 `weapp-vite` server（复用上面的 `mcpServers` 模板）。
4. 回到 Cline 对话，先请求 `tools/list`，再执行一次 `search_source_code` 验证工具可用。

### Codex

1. 打开 Codex 的 MCP Server 配置入口（UI 或配置文件）。
2. 新增 `weapp-vite` server，填入 `weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite`。
3. 保存后重启当前会话。
4. 先调用 `workspace_catalog`，再调用 `read_source_file` 读取一个已知文件，确认端到端可用。

### 客户端接入排查清单

1. `weapp-vite` 命令不可用：先在终端执行 `weapp-vite --version`，确认 PATH 可访问。
2. 工具列表为空：优先检查 `--workspace-root` 是否指向仓库根目录。
3. 能列工具但读不到文件：检查客户端工作目录权限与本地沙箱策略。
4. 需要 HTTP 连接时：改用 `streamable-http` 模式并确认地址可达（如 `http://127.0.0.1:3088/mcp`）。

## 能力清单

当前 MCP 服务主要暴露：

1. `workspace_catalog`
2. `list_source_files`
3. `read_source_file`
4. `search_source_code`
5. `run_package_script`
6. `run_weapp_vite_cli`
7. `run_repo_command`

建议调用顺序：

1. 先 `workspace_catalog` 了解边界。
2. 再 `search_source_code` / `read_source_file` 定位与确认。
3. 最后 `run_package_script` 做定向验证。

## 如何测试 MCP 是否可用

建议最少做三层验证：

1. 单测回归：

```bash
pnpm vitest run \
  packages/weapp-vite/src/cli/commands/mcp.test.ts \
  packages/weapp-vite/src/cli/mcpAutoStart.test.ts \
  packages/weapp-vite/src/mcp.test.ts
```

2. 构建验证：

```bash
pnpm --filter weapp-vite build
```

3. 连接验证（客户端实际列出 tools/resources）：
   使用你的 MCP Client 连上后执行 `tools/list`，确认能看到上面的 7 个工具。

## 示例：驱动 weapp-vite screenshot 做验收

下面给一个尽量简单的版本：只提供一段提示词，你直接贴给已接入 MCP 的 AI 即可。

前置条件：

1. 你的 AI 客户端已接入 `weapp-vite` MCP。
2. 微信开发者工具已登录，并开启「设置 -> 安全设置 -> 服务端口」。

### 可直接复制的提示词

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

### 期望结果

1. AI 输出 `screenshot-ok`。
2. 工作区产出文件 `.tmp/mcp-screenshot.png`。
3. AI 给出本次验收的执行摘要（命令、日志要点、结论）。

## 安全边界

MCP 服务端已做基础保护：

1. 文件访问限制在 workspace 根目录内。
2. 命令白名单限制为 `pnpm/node/git/rg`。
3. 命令输出和文件读取有截断与超时控制。

生产团队仍建议叠加外层隔离策略（容器、只读挂载、命令审计）。

## 关联阅读

1. [CLI 命令参考](/guide/cli)
2. [AI 学习入口](/ai)
3. [@weapp-vite/mcp 包说明](/packages/mcp)
