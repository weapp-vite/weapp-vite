---
name: docs-and-website-sync
description: 面向采用 weapp-vite monorepo 布局仓库的文档、website 与 skills 同步工作流。适用于代码能力已变化但 website/docs/README/skills/AI 指南/packaged docs 可能过期的场景，尤其覆盖 `weapp` 配置页、`dist/docs`、`AGENTS.md` 模板、AI skills 安装、`prepare`、MCP、`forwardConsole`、`screenshot/compare/ide logs`、Web runtime、lib mode、多平台与 routeRules/layout 等入口同步。
---

# docs-and-website-sync

## 用途

根据仓库真实能力，更新 `website`、`docs`、`README`、`skills`、脚手架 AI 指引和随包文档，避免公开入口落后于实现。

## 何时使用

- 用户要求“根据现有代码更新 website/docs/skills”。
- `weapp-vite`、`wevu`、`weapp-ide-cli` 或脚手架新增了配置、CLI 命令、AI 工作流。
- 网站配置页、AI 指南、包说明和 skills 之间出现漂移。
- 新增或调整这些公开能力：
  - `weapp.autoRoutes` / `routeRules` / layout
  - `.weapp-vite` 支持文件与 `wv prepare`
  - `forwardConsole` / `mcp init|print|doctor`
  - `wv screenshot` / `wv compare` / `wv ide logs`
  - `web` runtime / `lib` mode / 多平台 / npm / 分包 / worker
  - `create-weapp-vite` 的 AI skills 安装与 `AGENTS.md`

## 不适用场景

本 skill 聚焦“对外文档与技能入口同步”。

- 工程配置、构建策略、CLI 分发：使用 `weapp-vite-best-practices`。
- `.vue` 宏、模板和 SFC 兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 运行时语义：使用 `wevu-best-practices`。
- DevTools runtime e2e：使用 `weapp-devtools-e2e-best-practices`。

## 核心流程

1. 先查事实来源，不要在旧文案之间互相复制：
   - `packages/weapp-vite/src/types/config/**`
   - `packages/weapp-vite/src/cli/**`
   - `packages/weapp-ide-cli/src/cli/**`
   - `packages/weapp-vite/docs/README.md`
   - `packages/weapp-vite/docs/mcp.md`
   - `packages/weapp-vite/docs/volar.md`
   - `packages/weapp-vite/docs/define-config-overloads.md`
   - `packages/weapp-vite/docs/packaged/**`
   - `packages/weapp-vite/scripts/sync-package-docs.mjs`
   - `packages/create-weapp-vite/src/agents.ts`
   - `packages/create-weapp-vite/src/skills.ts`
   - `skills/*/SKILL.md`
2. 建立“能力变化 -> 入口页”映射，再统一修改：
   - 配置变化：`website/config/**`
   - CLI / AI / MCP：`website/guide/**`、`website/packages/**`、`website/.vitepress/components/AiLearningPage.vue`、`packages/weapp-vite/README.md`
   - 脚手架与 AI 约束：`website/packages/create-weapp-vite.md`、`packages/create-weapp-vite/src/agents.ts`
   - 运行时与框架：`website/config/vue.md`、`website/config/wevu.md`、`website/packages/web.md`
3. 同步 AI 合约口径：
   - 先读根 `AGENTS.md`
   - 再读 `node_modules/weapp-vite/dist/docs/*.md`
   - `MCP 接入` -> `wv mcp init|print|doctor <codex|claude-code|cursor>`
   - `运行时检查` -> `weapp_devtools_*` / `weapp_runtime_*` tools
   - `截图` -> `wv screenshot` / `take_weapp_screenshot`
   - `截图对比` -> `wv compare` / `compare_weapp_screenshot`
   - `日志` -> `wv ide logs --open`
   - `.weapp-vite` 支持文件 -> `wv prepare`
4. 生成资产只通过脚本或构建刷新，不手改：
   - `website/public/llms-index.json`
   - `website/public/seo-quality-report.json`
5. 若新增、删除或合并 skill，同时更新：
   - `website/guide/skills.md`
   - `website/guide/ai-workflows.md`
   - `website/guide/ai.md`
   - `website/.vitepress/components/AiLearningPage.vue`
   - `skills/skill-trigger-regression-checklist.md`
   - `skills/scripts/score-skill-trigger-regression.mjs`
   - `CLAUDE.md` 与脚手架 `AGENTS.md` 模板
6. 按最小范围验证：
   - `pnpm exec eslint --no-warn-ignored skills/*/SKILL.md`
   - 涉及 `website/**` 时跑 `pnpm --filter website-weapp-vite build`
   - 涉及 skill 触发/评分时再跑 `pnpm skills:check:yaml`、`pnpm skills:score:json`

## 约束

- 不要跳过源码核对直接改文案。
- 不要只改单一入口，遗漏 README、website、packaged docs 或 skills。
- 不要手工维护生成资产。
- 不要把小程序运行时截图能力写成泛化的浏览器截图。
- 不要忽略脚手架生成的 `AGENTS.md` 与本地 `dist/docs`，它们属于当前产品合约。

## 输出

应用本 skill 时，输出必须包含：

- 能力变化点。
- 受影响入口列表。
- 具体修改文件。
- 验证命令。
- 如有生成资产，说明刷新方式。

## 完成标记

- 配置页、CLI 页、AI 指南、包说明、skills 与真实实现一致。
- `wv` / `weapp-vite` 双命令、`prepare`、`mcp init|print|doctor`、`forwardConsole`、`screenshot/compare/ide logs` 没有文档漂移。
- `create-weapp-vite` 的 AI skills 安装与 `AGENTS.md` 模板说明一致。
- 本地随包文档 `dist/docs` 的优先级已经写清楚。

## 参考资料

- `references/docs-sync-checklist.md`
