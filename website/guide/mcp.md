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
