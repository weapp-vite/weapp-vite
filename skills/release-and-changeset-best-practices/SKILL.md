---
name: release-and-changeset-best-practices
description: Release and changeset workflow for the weapp-vite monorepo. Use this whenever the task involves adding changesets, deciding whether a change needs a release note, keeping `create-weapp-vite` in sync with `weapp-vite`/`wevu`/`templates/*`, checking Conventional Commits, or preparing package releases. Trigger on requests like "要不要加 changeset", "帮我补发版记录", "这个改动要不要 bump create-weapp-vite", "准备发布", "校验 changeset", or "按仓库规范提交/发布".
---

# release-and-changeset-best-practices

## Purpose

统一 weapp-vite monorepo 的 changeset、提交、版本联动和发布前检查，避免漏掉 `create-weapp-vite` bump、遗漏 changeset 或提交信息不符合仓库规范。

## Trigger Signals

- 用户问某个改动要不要加 changeset。
- 用户要补 `.changeset/*.md`。
- 用户准备发布或做 release 相关检查。
- 用户改了 `weapp-vite` / `wevu` / `templates/*`，需要判断是否联动 `create-weapp-vite`。
- 用户要求按仓库规范准备提交或发版。

## Scope Boundary

本 skill 聚焦发布与 changeset 治理。

以下情况不应作为主 skill：

- 主要是 GitHub issue 修复整体流程。使用 `github-issue-fix-workflow`。
- 主要是文档或网站同步。使用 `docs-and-website-sync`。
- 主要是项目架构或构建设计。使用 `weapp-vite-best-practices`。
- 主要是 DevTools runtime e2e。使用 `weapp-devtools-e2e-best-practices`。

## Quick Start

1. 先判断改动是否用户可见或行为受影响。
2. 需要 changeset 时，检查是否还要联动 `create-weapp-vite`。
3. 保持 changeset summary 使用中文。
4. 默认交付是 commit-only，不自动 push；GitHub issue 修复例外按 PR 流程走。

## Execution Protocol

1. 判断是否需要 changeset

- 用户可见改动、行为变化、源码 bug fix，默认需要 changeset。
- GitHub bug fix 不允许跳过 changeset。
- 只有纯内部、无用户感知且无发布影响的改动，才考虑不加。

2. 判断 `create-weapp-vite` 联动

- 如果 release 涉及：
  - `weapp-vite`
  - `wevu`
  - `templates/*`
- 则同时补 `create-weapp-vite` bump changeset，保持模板与依赖版本同步。

3. 保持 changeset 内容规范

- `.changeset/*.md` summary 段落使用中文。
- 变更说明要描述用户感知结果，而不是只写内部实现细节。

4. 提交与交付约束

- 使用 Conventional Commits。
- 默认只 commit，不 push。
- GitHub issue 修复任务按 PR 流程处理，不能用普通 commit-only 流程替代。

5. 发布前检查

- 优先复用仓库检查脚本：
  - `node --import tsx scripts/check-create-weapp-vite-changeset.ts`
  - `node --import tsx scripts/check-catalog-changeset.ts`
- 需要时再进入：
  - `pnpm release`
  - `pnpm cv`
  - `pnpm publish-packages`

## Guardrails

- 不要漏掉源码 bug fix 的 changeset。
- 不要改了 `weapp-vite` / `wevu` / `templates/*` 却忘了 `create-weapp-vite` bump。
- 不要写英文或空泛的 changeset summary。
- 不要默认帮用户 push。
- 不要把 issue 修复 PR 流程误降级成普通本地提交流程。

## Output Contract

应用本 skill 时，输出必须包含：

- 是否需要 changeset 及理由。
- 是否需要 `create-weapp-vite` 联动。
- 推荐提交类型或 release 动作。
- 对应检查命令。

## Completion Checklist

- changeset 需求已判断清楚。
- 需要时已补 `.changeset/*.md` 且 summary 为中文。
- 需要时已补 `create-weapp-vite` bump。
- 提交方式符合 Conventional Commits。
- 交付方式符合 commit-only / PR 例外规则。
- 相关 release 检查脚本已运行或已说明未运行原因。

## References

- `references/release-checklist.md`
