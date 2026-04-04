---
name: release-and-changeset-best-practices
description: 面向采用 weapp-vite monorepo 布局仓库的 release 与 changeset 工作流。适用于判断某次改动是否需要 changeset、是否联动 `create-weapp-vite`、如何处理 `website/skills/dist/docs/AGENTS.md`、AI skills 安装、`prepare`、MCP、`screenshot/compare/ide logs`、Web runtime、lib mode 等用户可见能力变更后的发版判定。
---

# release-and-changeset-best-practices

## 用途

统一 changeset、提交、版本联动和发布前检查，避免漏掉用户可见改动和脚手架联动。

## 何时使用

- 用户问“这个改动要不要加 changeset”。
- 用户要补 `.changeset/*.md`。
- 用户准备发布。
- 用户改了 `weapp-vite` / `wevu` / `templates/*` / `skills/*` / `dist/docs` / `AGENTS.md` / website。
- 用户改了 AI 使用路径，如 screenshot / compare / MCP / logs / skills 安装。

## 不适用场景

本 skill 聚焦发布判定和 changeset 治理。

- issue 修复流程：使用 `github-issue-fix-workflow`。
- 文档同步：使用 `docs-and-website-sync`。
- 构建或运行时设计：使用对应 best-practices skill。

## 核心流程

1. 先判断改动是否用户可见；源码 bug fix、功能新增、行为变化、模板行为变化默认要补 changeset。
2. 下列改动不要轻易归类为“纯内部维护”：
   - `skills/*`
   - `dist/docs`
   - 脚手架生成 `AGENTS.md`
   - AI skills 安装行为
   - `prepare` / `mcp` / `forwardConsole`
   - `wv screenshot` / `wv compare` / `wv ide logs`
   - `web` runtime / `lib` mode
3. 若 release 涉及 `weapp-vite`、`wevu` 或 `templates/*`，默认联动补 `create-weapp-vite` bump。
4. changeset summary 用中文，描述用户感知结果，不写成内部重构流水账。
5. 交付遵循 Conventional Commits；默认 commit-only，issue 修复走 PR 流程。
6. 发布前优先跑仓库脚本：
   - `node --import tsx scripts/check-create-weapp-vite-changeset.ts`
   - `node --import tsx scripts/check-catalog-changeset.ts`
   - 需要时再跑 `pnpm release`、`pnpm cv`、`pnpm publish-packages`

## 约束

- 不要漏掉源码 bug fix 的 changeset。
- 不要忘记 `create-weapp-vite` 联动。
- 不要写英文或空泛的 summary。
- 不要把用户可见的 AI / docs / template 合约误判成纯内部改动。

## 输出

应用本 skill 时，输出必须包含：

- 是否需要 changeset 及理由。
- 是否需要 `create-weapp-vite` 联动。
- 推荐提交类型。
- 推荐检查命令。

## 完成标记

- changeset 需求已判断清楚。
- 需要时已补中文 changeset。
- 需要时已补 `create-weapp-vite` bump。
- 提交方式和交付方式符合仓库规则。

## 参考资料

- `references/release-checklist.md`
