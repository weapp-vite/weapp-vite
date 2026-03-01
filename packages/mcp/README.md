# @weapp-vite/mcp

## 简介

`@weapp-vite/mcp` 是面向 `weapp-vite` / `wevu` monorepo 的 MCP 服务端实现，目标是把核心研发能力暴露给 AI：

- 包目录与能力发现
- 源码读取、检索、按行裁剪
- 包级脚本执行
- `weapp-vite` CLI 执行
- 文档/变更记录资源暴露
- 调试/改造提示词模板

默认通过 `stdio` 运行，适合接入任意 MCP Client。

## 启动

```bash
pnpm --filter @weapp-vite/mcp start
```

## 主要 Tools

- `workspace_catalog`: 输出 `weapp-vite / wevu / wevu-compiler` 目录、版本、脚本
- `list_source_files`: 列出包内文件（默认 `src`）
- `read_source_file`: 读取包内文件，支持 `startLine/endLine/maxChars`
- `search_source_code`: 在包源码中检索关键词
- `run_package_script`: 在指定包目录执行 `pnpm run <script>`
- `run_weapp_vite_cli`: 执行 `node packages/weapp-vite/bin/weapp-vite.js ...`
- `run_repo_command`: 执行仓库级命令（`pnpm/node/git/rg`）

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

## 开发

```bash
pnpm --filter @weapp-vite/mcp test
pnpm --filter @weapp-vite/mcp build
```

## 相关链接

- MCP SDK: https://github.com/modelcontextprotocol/sdk
- 仓库: https://github.com/weapp-vite/weapp-vite
