---
title: "@weapp-vite/mcp"
description: "@weapp-vite/mcp 是 weapp-vite 官方 MCP 服务实现，面向 AI 助手提供源码检索、命令执行与文档资源能力。"
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

在当前版本中，`weapp-vite` 已集成该能力。大多数场景下，你不需要单独使用此包，而是直接通过 `wv mcp` 启动。

## 推荐使用方式

```bash
wv mcp
```

如果你的 AI 客户端支持 `streamable-http`，也可以切换到 HTTP 传输：

```bash
wv mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

## 何时使用

1. 你要让 AI 助手直接读取 `weapp-vite` 仓库源码与文档。
2. 你要让 AI 在受限命令白名单下完成“修改 + 验证”闭环。
3. 你要基于官方 MCP 能力扩展团队内部 AI 工作流。

## 安装

```bash
pnpm add @weapp-vite/mcp
```

## 启动方式

不在仓库目录执行时，可选追加 `--workspace-root /path/to/weapp-vite`。

如果你只想单独运行包本身：

```bash
pnpm --filter @weapp-vite/mcp start
```

## 主要能力

### Tools

| Tool                       | 作用                                       | 关键输入                                                |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `workspace_catalog`        | 输出暴露包目录、版本、脚本清单             | 无                                                      |
| `list_source_files`        | 列出包内文件（默认 `src`）                 | `packageId`、`directory`、`maxResults`                  |
| `read_source_file`         | 读取源码文件，支持行区间裁剪               | `packageId`、`filePath`、`startLine`、`endLine`         |
| `search_source_code`       | 在源码里做关键词检索                       | `query`、`packageId`、`directory`                       |
| `run_package_script`       | 在指定包目录执行 `pnpm run <script>`       | `packageId`、`script`、`args`                           |
| `run_weapp_vite_cli`       | 调用 `weapp-vite` CLI                      | `subCommand`、`projectPath`、`platform`、`args`         |
| `take_weapp_screenshot`    | 显式截图工具，封装 `wv screenshot --json`  | `projectPath`、`page`、`outputPath`                     |
| `compare_weapp_screenshot` | 显式截图对比工具，封装 `wv compare --json` | `projectPath`、`baselinePath`、`page`、`diffOutputPath` |
| `run_repo_command`         | 执行仓库级白名单命令                       | `command`、`args`、`cwdRelative`                        |

### Resources

| Resource                                    | 说明                         |
| ------------------------------------------- | ---------------------------- |
| `weapp-vite://workspace/catalog`            | 工作区包目录、版本、脚本索引 |
| `weapp-vite://docs/{package}/README.md`     | 暴露包的 README              |
| `weapp-vite://docs/{package}/CHANGELOG.md`  | 暴露包的 CHANGELOG           |
| `weapp-vite://source/{package}?path={path}` | 读取指定源码文件             |

### Prompts

| Prompt                   | 说明                                  |
| ------------------------ | ------------------------------------- |
| `plan-weapp-vite-change` | 生成 weapp-vite / wevu 改造计划提示词 |
| `debug-wevu-runtime`     | 生成 wevu runtime 排查提示词          |

## AI 友好的截图工具

为了让 AI 在自然语言里更稳定地命中 mini-program runtime 能力，`@weapp-vite/mcp` 额外提供：

- `take_weapp_screenshot`
  - 面向“截图 / 页面快照 / runtime screenshot”
- `compare_weapp_screenshot`
  - 面向“截图对比 / diff / baseline / 视觉回归 / 像素对比”

这两个工具本质上分别封装了 `wv screenshot --json` 与 `wv compare --json`，但对 AI 更容易命中，也更适合在 prompt 里直接点名。

### `take_weapp_screenshot` 输入参数

| 参数          | 说明                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `projectPath` | 相对 workspace 根路径，通常是 `dist/build/mp-weixin` 或具体小程序项目目录 |
| `page`        | 可选；截图前先跳转到指定页面                                              |
| `outputPath`  | 可选；截图输出路径，建议写入 `.tmp/`                                      |
| `timeoutMs`   | 可选；命令超时                                                            |

### `compare_weapp_screenshot` 输入参数

| 参数                | 说明                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `projectPath`       | 相对 workspace 根路径，通常是 `dist/build/mp-weixin` 或具体小程序项目目录 |
| `baselinePath`      | 相对 workspace 根路径的 baseline 图片路径                                 |
| `page`              | 可选；对比前先跳转页面                                                    |
| `currentOutputPath` | 可选；保存当前截图                                                        |
| `diffOutputPath`    | 可选；保存 diff 图                                                        |
| `threshold`         | 可选；pixelmatch threshold，范围 `0-1`                                    |
| `maxDiffPixels`     | 可选；最大允许差异像素数                                                  |
| `maxDiffRatio`      | 可选；最大允许差异占比，范围 `0-1`                                        |
| `timeoutMs`         | 可选；命令超时                                                            |

> **注意**：对比类工作流里，建议显式传入 `diffOutputPath`，这样 AI 在失败时能直接产出 diff 图用于复盘。

## 推荐提示词写法

如果你希望 AI 不要退化成浏览器截图，而是直接使用小程序运行时能力，建议在提示词里直接写：

```text
提到截图时优先使用 take_weapp_screenshot。
提到截图对比、baseline、diff、视觉回归时优先使用 compare_weapp_screenshot。
先读取 node_modules/weapp-vite/dist/docs/index.md 与 node_modules/weapp-vite/dist/docs/mcp.md。
```

如果项目是通过 `create-weapp-vite` 初始化的，根目录里的 `AGENTS.md` 通常也已经内置了这类 AI 意图路由规则。

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
3. [CLI 命令参考](/guide/cli)
