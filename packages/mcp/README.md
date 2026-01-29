# @weapp-vite/mcp

## 简介

`@weapp-vite/mcp` 是一个基于 Model Context Protocol (MCP) SDK 的示例服务包，展示如何通过 stdio 传输方式注册工具并响应调用。

> 该包目前以示例为主，适合用于学习/验证 MCP 工具服务的基本结构。

## 特性

- 使用 MCP SDK 创建服务
- 基于 zod 的入参校验
- 内置示例工具（`calculate-bmi`、`fetch-weather`）
- stdio 传输，方便被 MCP Client 集成

## 安装

```bash
pnpm add @weapp-vite/mcp
```

## 使用

在仓库内启动示例服务：

```bash
pnpm --filter @weapp-vite/mcp start
```

然后由 MCP Client 通过 stdio 连接并调用工具。

## 配置

目前没有独立配置文件。请直接修改 `src/index.ts` 来：

- 添加/移除工具
- 调整工具参数与逻辑
- 修改服务名称与版本

## 相关链接

- MCP SDK：https://github.com/modelcontextprotocol/sdk
- 仓库：https://github.com/weapp-vite/weapp-vite
