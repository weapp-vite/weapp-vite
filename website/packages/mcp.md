---
title: "@weapp-vite/mcp"
description: "@weapp-vite/mcp 是一个 MCP 示例服务包，用于展示如何基于 MCP SDK 注册工具并通过 stdio 传输响应调用。"
keywords:
  - Weapp-vite
  - packages
  - mcp
  - "@weapp-vite/mcp"
  - 是一个
  - 示例服务包
  - 用于展示如何基于
  - sdk
---

# @weapp-vite/mcp

`@weapp-vite/mcp` 是一个 MCP 示例服务包，用于展示如何基于 MCP SDK 注册工具并通过 stdio 传输响应调用。

> 该包以教学和验证为主，不是面向生产的完整服务框架。

## 何时使用

- 你要快速理解 MCP 服务端最小结构
- 你要验证 MCP Client 与 stdio 服务联调流程
- 你要基于示例改造自己的工具服务

## 安装

```bash
pnpm add @weapp-vite/mcp
```

## 运行示例

```bash
pnpm --filter @weapp-vite/mcp start
```

包内示例包含两个工具：

- `calculate-bmi`
- `fetch-weather`

## 二次开发建议

直接修改 `packages/mcp/src/index.ts`：

- 新增工具与参数 schema（zod）
- 调整服务 `name/version`
- 接入真实业务 API 与鉴权逻辑
