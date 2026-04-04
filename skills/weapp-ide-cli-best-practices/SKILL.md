---
name: weapp-ide-cli-best-practices
description: 面向结合 weapp-ide-cli 与 weapp-vite 使用场景的命令治理与自动化实践手册，覆盖官方 CLI 透传、`preview/upload/open/login/screenshot/compare/ide logs`、automator 增强命令、`config doctor/export/import`、i18n 持久化、命令目录导出，以及与 `weapp-vite` 原生命令优先 + catalog 透传的 AI 友好集成契约。
---

# weapp-ide-cli-best-practices

## 用途

让 `weapp-ide-cli` 的命令行为、参数体验、JSON 输出和上游 CLI 集成契约保持稳定、可自动化、对 AI 友好。

## 何时使用

- 用户要新增或改造 `weapp-ide-cli` 命令。
- 用户要增强 screenshot / compare / automator / logs。
- 用户要暴露命令目录给上游 CLI 复用。
- 用户要改 i18n、配置持久化或 doctor / export / import。
- 用户要优化 `weapp-vite` 和 `weapp-ide-cli` 的透传边界。

## 不适用场景

本 skill 聚焦命令治理、配置持久化和跨包 CLI 合约。

- 工程构建和配置：使用 `weapp-vite-best-practices`。
- DevTools runtime e2e：使用 `weapp-devtools-e2e-best-practices`。
- `wevu` 或 `.vue` 运行时问题：使用对应 skill。

## 核心流程

1. 先明确改动属于哪类命令：
   - 官方 CLI 透传
   - automator 增强命令
   - `config` 子命令
   - `minidev` 命名空间
2. 命令目录只保留一个 source-of-truth，尤其是 `screenshot`、`compare`、`ide logs`。
3. 强化参数和输出契约：
   - `compare` 的 `--baseline` 必填，阈值语义清晰，失败返回非零退出码
   - `screenshot` / `compare` 的文件输出和 `--json` 结构稳定
   - `ide logs` 的持续监听与退出行为明确
4. i18n 与配置保持一致：默认中文，支持命令级覆盖和持久化配置。
5. 上游 `weapp-vite` 必须先执行原生命令，仅在 `isWeappIdeTopLevelCommand(command)` 命中时再透传，不要对未知命令盲目 passthrough。
6. 若截图、对比、日志语义变化，同步检查 `@weapp-vite/mcp`、`packages/weapp-vite/docs/packaged/ai-workflows.md`、脚手架 `AGENTS.md`。

## 约束

- 不要在多个包维护独立的命令名单。
- 不要让未知命令静默透传。
- 不要新增用户提示却不走 i18n。
- 不要让 screenshot / compare 的文件或 JSON 合约漂移。

## 输出

应用本 skill 时，输出必须包含：

- 命令级设计摘要。
- 具体改动文件。
- 验证命令。
- 如涉及上游集成，说明跨包契约影响。

## 完成标记

- 命令目录和命中谓词已导出。
- dispatch 优先级清晰且有测试。
- screenshot / compare / logs 对 AI 友好且契约稳定。
- `weapp-vite` 集成未复制独立名单。

## 参考资料

- `references/command-catalog-and-dispatch.md`
- `references/i18n-config-playbook.md`
