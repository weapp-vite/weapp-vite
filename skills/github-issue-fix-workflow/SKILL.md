---
name: github-issue-fix-workflow
description: 面向采用 weapp-vite monorepo 布局仓库的 GitHub issue 修复工作流。适用于从隔离 worktree 开始，完成“复现 -> 根因分析 -> 修 packages/weapp-vite|wevu|weapp-ide-cli|website|skills -> unit/e2e/截图验收 -> changeset -> PR”的闭环，也覆盖 `screenshot/compare/ide logs`、MCP、`dist/docs`、`AGENTS.md`、文档与 skill 同步等 GitHub issue 收尾动作。
---

# github-issue-fix-workflow

## 目的

把 GitHub issue 修复流程标准化，确保每次都按“独立 worktree、先复现、后修复、补回归、再 PR”的顺序推进。

## 触发信号

- 用户要求修某个 GitHub issue。
- 用户要求在 `e2e-apps/github-issues` 落一个复现案例。
- 用户要求“按仓库流程修这个问题”或“开 PR 修复”。
- 用户要求用真实运行时截图、截图对比、日志桥接或 MCP 工具证明问题已修复。

## 适用边界

本 skill 聚焦 issue 修复闭环。

以下情况不应作为主 skill：

- 只是常规项目配置优化。使用 `weapp-vite-best-practices`。
- 只是 `.vue` 宏和模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 只是 `wevu` 运行时语义。使用 `wevu-best-practices`。
- 只是文档或 skills 对齐。使用 `docs-and-website-sync`。

## 快速开始

1. 从主线创建独立 `git worktree`。
2. 在 `e2e-apps/github-issues` 先建立最小复现。
3. 根因稳定后再改源码。
4. 用 unit/e2e/截图或日志把回归锁死。
5. 补 changeset，开 PR。

## 执行流程

1. 隔离工作区

- 在仓库可写目录内创建 worktree，例如 `.codex-tmp/<issue>`.
- 不要在已有脏工作区里直接修 issue。

2. 先复现，后修复

- 优先在 `e2e-apps/github-issues` 落最小复现。
- 如果问题涉及 CLI、MCP、skills、website、packaged docs，也要先找到能稳定证明问题的入口。
- 若问题无法稳定复现，不要直接碰源码。

3. 做根因分析

- 先判断问题在哪一层：
  - `weapp-vite` 配置/构建/CLI
  - `weapp-ide-cli` / automator / compare
  - `wevu` 运行时
  - `wevu-compiler` / Vue SFC
  - docs / skills / AI contract
  - DevTools 环境限制

4. 修复时保持范围清晰

- 只改根因相关包。
- 若修复改到 `packages/*/src/**`，下游验证前先重建对应包。
- 若 issue 影响公开 AI 路径，同步修：
  - `AGENTS.md` 模板
  - `dist/docs`
  - website / README / skills

5. 锁定回归

- 补或更新 unit tests。
- 补或更新 e2e tests。
- 如最终验收依赖真实运行时，优先固定：
  - `wv screenshot`
  - `wv compare`
  - `wv ide logs --open`
  - `take_weapp_screenshot`
  - `compare_weapp_screenshot`

6. 交付要求

- 源码 bug fix 默认必须补 changeset。
- 若发布影响 `weapp-vite`、`wevu` 或 `templates/*`，联动补 `create-weapp-vite` bump。
- PR 标题、正文和 review comment 默认中文。

## 约束

- 不要跳过 `git worktree`。
- 不要在复现不稳定时直接修源码。
- 不要只补 unit 不补 e2e，或只补 e2e 不补 unit。
- 不要遗漏 changeset。
- 不要把真实 DevTools 环境问题误判成产品逻辑回归。

## 输出要求

应用本 skill 时，输出必须包含：

- 复现路径。
- 根因结论。
- 源码修复范围。
- unit / e2e / 截图或日志验收状态。
- changeset / PR 状态。

## 完成检查

- 独立 worktree 已创建并使用。
- 最小复现已建立或已说明为何不需要。
- 根因与修复一一对应。
- 回归测试已锁定。
- 影响公开 AI/CLI/文档合约时，相关入口已同步。

## 参考资料

- `references/issue-fix-checklist.md`
