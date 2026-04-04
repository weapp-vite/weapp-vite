---
name: github-issue-fix-workflow
description: 面向采用 weapp-vite monorepo 布局仓库的 GitHub issue 修复工作流。适用于从隔离 worktree 开始，完成“复现 -> 根因分析 -> 修 packages/weapp-vite|wevu|weapp-ide-cli|website|skills -> unit/e2e/截图验收 -> changeset -> PR”的闭环，也覆盖 `screenshot/compare/ide logs`、MCP、`dist/docs`、`AGENTS.md`、文档与 skill 同步等 GitHub issue 收尾动作。
---

# github-issue-fix-workflow

## 用途

把 GitHub issue 修复流程标准化，确保每次都按“独立 worktree、先复现、后修复、补回归、再 PR”的顺序推进。

## 何时使用

- 用户要求修某个 GitHub issue。
- 用户要求在 `e2e-apps/github-issues` 落一个复现案例。
- 用户要求“按仓库流程修这个问题”或“开 PR 修复”。
- 用户要求用真实运行时截图、截图对比、日志桥接或 MCP 工具证明问题已修复。

## 不适用场景

本 skill 聚焦 issue 修复闭环。

- 常规项目配置优化：使用 `weapp-vite-best-practices`。
- `.vue` 宏和模板兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 运行时语义：使用 `wevu-best-practices`。
- 文档或 skills 对齐：使用 `docs-and-website-sync`。

## 核心流程

1. 在仓库可写目录创建独立 `git worktree`，例如 `.codex-tmp/<issue>`。
2. 先在 `e2e-apps/github-issues` 或其他最小入口稳定复现；无法稳定复现时不要直接改源码。
3. 先分层定位根因：
   - `weapp-vite` 配置 / 构建 / CLI
   - `weapp-ide-cli` / automator / compare
   - `wevu` / `wevu-compiler`
   - docs / skills / AI contract
   - DevTools 环境限制
4. 修复只覆盖根因相关包；如果动到 `packages/*/src/**`，下游验证前先重建对应包。
5. 用回归把问题锁死：
   - unit tests
   - e2e tests
   - 真实运行时验收需要时补 `wv screenshot`、`wv compare`、`wv ide logs --open`
6. 交付时补齐 changeset、文档、skills、`AGENTS.md`、`dist/docs` 等公开合约，并按 PR 流程收尾。

## 约束

- 不要跳过 `git worktree`。
- 不要在复现不稳定时直接修源码。
- 不要只补 unit 不补 e2e，或只补 e2e 不补 unit。
- 不要遗漏 changeset。
- 不要把真实 DevTools 环境问题误判成产品逻辑回归。

## 输出

应用本 skill 时，输出必须包含：

- 复现路径。
- 根因结论。
- 源码修复范围。
- unit / e2e / 截图或日志验收状态。
- changeset / PR 状态。

## 完成标记

- 独立 worktree 已创建并使用。
- 最小复现已建立或已说明为何不需要。
- 根因与修复一一对应。
- 回归测试已锁定。
- 影响公开 AI/CLI/文档合约时，相关入口已同步。

## 参考资料

- `references/issue-fix-checklist.md`
