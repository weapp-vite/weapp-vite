---
title: "@weapp-vite/mcp"
description: "@weapp-vite/mcp 是 weapp-vite 与 wevu 的 MCP 服务实现，面向 AI 助手提供源码检索、命令执行与文档资源能力。"
keywords:
  - Weapp-vite
  - packages
  - mcp
  - "@weapp-vite/mcp"
  - ai
  - sdk
---

# @weapp-vite/mcp

`@weapp-vite/mcp` 是 `weapp-vite` 官方维护的 MCP 服务实现，目标是把 `weapp-vite / wevu / wevu-compiler` 的关键研发能力暴露给 AI 助手。

在当前版本中，`weapp-vite` 已集成该能力，你通常不需要单独使用此包，而是直接通过 `weapp-vite mcp` 启动。

## 何时使用

1. 你要让 AI 助手直接读取 `weapp-vite` 仓库源码与文档。
2. 你要让 AI 在受限命令白名单下完成“修改 + 验证”闭环。
3. 你要基于官方 MCP 能力扩展团队内部 AI 工作流。

## 安装

```bash
pnpm add @weapp-vite/mcp
```

## 启动方式

推荐直接使用 `weapp-vite` CLI：

```bash
weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite
```

如果你只想单独运行包本身：

```bash
pnpm --filter @weapp-vite/mcp start
```

## 主要能力

Tools：

1. `workspace_catalog`
2. `list_source_files`
3. `read_source_file`
4. `search_source_code`
5. `run_package_script`
6. `run_weapp_vite_cli`
7. `run_repo_command`

Resources：

1. `weapp-vite://workspace/catalog`
2. `weapp-vite://docs/{package}/README.md`
3. `weapp-vite://docs/{package}/CHANGELOG.md`
4. `weapp-vite://source/{package}?path={path}`

Prompts：

1. `plan-weapp-vite-change`
2. `debug-wevu-runtime`

## 安全约束

1. 文件读取限制在 workspace 根目录内。
2. 命令执行限制在白名单（`pnpm/node/git/rg`）。
3. 输出内容有截断与超时保护。

## 二次开发建议

若你要扩展能力，建议从以下文件开始：

1. `packages/mcp/src/server.ts`：工具/资源/Prompt 注册入口。
2. `packages/mcp/src/fileOps.ts`：文件读取与搜索策略。
3. `packages/mcp/src/commandOps.ts`：命令白名单与执行约束。

## 关联阅读

1. [AI 协作指南](/guide/ai)
2. [AI 学习入口](/ai)
