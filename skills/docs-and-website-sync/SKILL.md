---
name: docs-and-website-sync
description: 面向采用 weapp-vite monorepo 布局仓库的文档、website 与 skills 同步工作流。适用于代码能力已变化但 website/docs/README/skills/AI 指南/packaged docs 可能过期的场景，尤其覆盖 `weapp` 配置页、`dist/docs`、`AGENTS.md` 模板、AI skills 安装、`prepare`、MCP、`forwardConsole`、`screenshot/compare/ide logs`、Web runtime、lib mode、多平台与 routeRules/layout 等入口同步。
---

# docs-and-website-sync

## 目的

根据仓库真实能力，更新 `website`、`docs`、`README`、`skills`、脚手架 AI 指引和随包文档，避免公开入口落后于实现。

## 触发信号

- 用户要求“根据现有代码更新 website/docs/skills”。
- `weapp-vite`、`wevu`、`weapp-ide-cli` 或脚手架新增了配置、CLI 命令、AI 工作流。
- 网站配置页、AI 指南、包说明和 skills 之间出现漂移。
- 新增或调整了这些公开能力：
  - `weapp.autoRoutes` / `routeRules` / layout
  - `.weapp-vite` 支持文件与 `prepare`
  - `forwardConsole`
  - `mcp`
  - `screenshot` / `compare` / `ide logs`
  - `web` runtime
  - `lib` mode
  - 多平台 / npm / 分包 / worker
  - `create-weapp-vite` 的 AI skills 安装与 `AGENTS.md`

## 适用边界

本 skill 聚焦“对外文档与技能入口同步”。

以下情况不应作为主 skill：

- 主要是工程配置、构建策略、CLI 分发。使用 `weapp-vite-best-practices`。
- 主要是 `.vue` 宏、模板和 SFC 兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要是 `wevu` 运行时语义。使用 `wevu-best-practices`。
- 主要是 DevTools runtime e2e。使用 `weapp-devtools-e2e-best-practices`。

## 快速开始

1. 先核对源码、类型定义、CLI 命令和脚手架输出。
2. 再列出所有受影响的公开入口。
3. 先改源文档与 skill，再刷新生成资产。
4. 最后做最小构建和语义校验。

## 执行流程

1. 先找事实来源

- 优先读取：
  - `packages/weapp-vite/src/types/config/**`
  - `packages/weapp-vite/src/cli/**`
  - `packages/weapp-ide-cli/src/cli/**`
  - `packages/weapp-vite/docs/packaged/**`
  - `packages/create-weapp-vite/src/agents.ts`
  - `packages/create-weapp-vite/src/skills.ts`
  - `skills/*/SKILL.md`
- 不要只在旧网站文案之间互相复制。

2. 建立“能力变化 -> 入口页”映射

- 配置变化：
  - `website/config/**`
- CLI / AI / MCP：
  - `website/guide/cli.md`
  - `website/guide/index.md`
  - `website/packages/mcp.md`
  - `website/packages/weapp-ide-cli.md`
  - `packages/weapp-vite/README.md`
  - `packages/weapp-vite/docs/packaged/ai-workflows.md`
- 脚手架与 AI 约束：
  - `website/packages/create-weapp-vite.md`
  - `packages/create-weapp-vite/src/agents.ts`
  - `AGENTS.md` 模板与相关 skill
- 运行时与框架：
  - `website/config/vue.md`
  - `website/config/wevu.md`
  - `website/packages/web.md`

3. 同步 AI 合约

- 若能力影响 AI 使用路径，必须同步这些口径：
  - 先读根 `AGENTS.md`
  - 再读 `node_modules/weapp-vite/dist/docs/*.md`
  - `截图` -> `weapp-vite screenshot` / `take_weapp_screenshot`
  - `截图对比` -> `weapp-vite compare` / `compare_weapp_screenshot`
  - `日志` -> `weapp-vite ide logs --open`
  - `.weapp-vite` 类型与支持文件 -> `weapp-vite prepare`
  - 仅当目标明确是 Web runtime 时，才切到浏览器截图链路

4. 处理生成资产

- 不手改以下生成文件：
  - `website/public/llms-index.json`
  - `website/public/seo-quality-report.json`
- 通过构建或脚本刷新。

5. 验证顺序

- 先验证 skill / 文档语义：
  - `pnpm exec eslint --no-warn-ignored skills/*/SKILL.md`
- 涉及 `website/**` 时，再跑：
  - `pnpm --filter website-weapp-vite build`
- 涉及 skill 评分或触发回归时，再跑：
  - `pnpm skills:check:yaml`
  - `pnpm skills:score:json`

## 约束

- 不要跳过源码核对直接改文案。
- 不要只改单一入口，遗漏 README、website、packaged docs 或 skills。
- 不要手工维护生成资产。
- 不要把小程序运行时截图能力写成泛化的浏览器截图。
- 不要忽略脚手架生成的 `AGENTS.md` 与本地 `dist/docs`，它们属于当前产品合约。

## 输出要求

应用本 skill 时，输出必须包含：

- 能力变化点。
- 受影响入口列表。
- 具体修改文件。
- 验证命令。
- 如有生成资产，说明刷新方式。

## 完成检查

- 配置页、CLI 页、AI 指南、包说明、skills 与真实实现一致。
- `wv` / `weapp-vite` 双命令、`prepare`、MCP、`forwardConsole`、`screenshot/compare/ide logs` 没有文档漂移。
- `create-weapp-vite` 的 AI skills 安装与 `AGENTS.md` 模板说明一致。
- 本地随包文档 `dist/docs` 的优先级已经写清楚。

## 参考资料

- `references/docs-sync-checklist.md`
