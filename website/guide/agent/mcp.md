---
title: "MCP 与开发者工具"
description: "复用项目安装的开发能力。"
sidebar:
  order: 8
---

## 对外验收服务

使用 `weapp-agent -C /path/to/project mcp` 向 Codex 等宿主提供工程检查和验收任务。这个入口不调用模型，具体配置见[接入与验收](/guide/acceptance)。

下面介绍的是独立 agent 模式消费项目工具的 MCP client，与对外服务方向不同。

## 自动发现

可信的 weapp-vite 项目会尝试启动本地 CLI 的 MCP 服务：

```bash
node node_modules/weapp-vite/bin/weapp-vite.js mcp --workspace-root /path/to/project
```

agent 通过工具发现获取能力，不假定源码 monorepo 的包目录工具也适用于普通业务项目。连接失败会记录原因，文件工具与其他可用能力仍可继续使用。

## 自定义服务

配置 `mcp` 数组，支持 stdio 和 Streamable HTTP：

```json
[
  { "name": "local-tools", "transport": "stdio", "command": "node", "args": ["./tools/mcp.mjs"] },
  { "name": "remote-tools", "transport": "http", "url": "https://example.com/mcp", "tokenEnv": "MCP_TOKEN" }
]
```

工具命名为 `服务名__工具名`。第三方服务的 `readOnly` 注解不是授权依据；未知调用仍需审批。远程 HTTP 服务要求 HTTPS，本机 localhost 可使用 HTTP。

## 生命周期

每次任务复用同一 MCP client；工具调用传递取消信号并设置超时。任务结束关闭连接和本次启动的子进程。不会关闭其他 agent 或用户启动的开发者工具进程。
