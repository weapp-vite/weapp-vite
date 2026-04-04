---
name: docs-and-website-sync
description: 面向采用 weapp-vite monorepo 布局仓库的文档、website 与 skills 同步工作流。适用于代码能力已变化但 website/docs/README/skills/AI 指南/release notes/packaged docs 可能过期的场景，或用户提出“update website”“sync docs with current code”“refresh AI guide/skills page”“根据现有能力重写技能总结”“补配置文档”“同步 routeRules/layout/MCP/prepare/managed tsconfig/`wv`/`dist/docs`/`AGENTS.md`/skills 安装/截图对比文档”等请求。始终先核对真实源码、类型定义、CLI 命令与脚本，再同步受影响的入口页、skill 元数据以及生成的 LLM/SEO 资产。
---

# docs-and-website-sync

## Purpose

根据仓库真实能力，更新 `website`、`skills`、`README/CLAUDE` 等对外入口，并确保生成产物（如 `llms-index.json`、`seo-quality-report.json`）与源码一致。

## 触发信号

- 用户要求“根据现有代码更新 website/docs/skills”。
- 新增或调整了 CLI 命令、包能力、skill、AI 协作入口。
- `website` 页面、`guide/ai`、`packages/*` 页面描述已经落后于实现。
- 技能列表、安装方式、调用示例与当前仓库状态不一致。
- `create-weapp-vite` 的 AI skills 安装行为、`AGENTS.md` 模板或 `weapp-vite` 的 `dist/docs` 随包文档发生变化。
- 新增了 screenshot / compare / ide logs / MCP explicit tools 等 AI 入口，但 website 或 skills 还没同步。
- 需要刷新 `llms` / SEO 相关生成资产。

## 适用边界

本 skill 聚焦“文档入口同步”和“网站内容校准”。

以下情况不应作为主 skill：

- 主要问题是工程架构、分包、构建编排。使用 `weapp-vite-best-practices`。
- 主要问题是 `.vue` 宏或模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要问题是 `wevu` 运行时语义或 store/lifecycle。使用 `wevu-best-practices`。
- 主要问题是性能诊断与治理。使用 `weapp-vite-wevu-performance-best-practices`。

## 快速开始

1. 先从源码、CLI、脚本、skill 目录确认“真实能力”。
2. 再找所有对外入口页：`website`、`skills`、`README`、`CLAUDE`、博客或包说明。
3. 先更新源文档，再通过构建刷新生成资产。
4. 最后用最小验证确认页面可构建、skill 元数据可解析。

## 执行流程

1. 先找事实来源

- 优先读取：
  - `packages/*/src/**`
  - `packages/*/README.md`
  - `packages/weapp-vite/src/cli/**`
  - `packages/weapp-vite/docs/packaged/**`
  - 根 `package.json` scripts
  - `packages/create-weapp-vite/src/agents.ts`
  - `packages/create-weapp-vite/src/skills.ts`
  - `skills/*/SKILL.md` 与 `skills/*/agents/openai.yaml`
- 避免只根据旧网站文案互相抄写。

2. 建立“能力变化 -> 文档入口”映射

- CLI / MCP / AI 协作：优先检查
  - `website/guide/ai.md`
  - `website/packages/mcp.md`
  - `website/guide/cli.md`
  - `website/guide/index.md`
  - `website/guide/what-is-weapp-vite.md`
  - `website/troubleshoot/index.md`
  - `website/handbook/getting-started.md`
  - `website/handbook/project-structure.md`
  - `website/.vitepress/components/AiLearningPage.vue`
  - `packages/weapp-vite/README.md`
  - `packages/weapp-vite/docs/mcp.md`
  - `packages/weapp-vite/dist/docs/*` 的生成来源
- skill 新增或变更：优先检查
  - `website/guide/ai.md`
  - `website/packages/index.md`
  - `website/packages/create-weapp-vite.md`
  - `CLAUDE.md`
  - 脚手架生成的 `AGENTS.md` 约定
  - `npx skills add sonofmagic/skills` 与 `pnpm skills:link` 的安装/直连说明
  - `skills/skill-trigger-regression-checklist.md`
  - `skills/scripts/score-skill-trigger-regression.mjs`
- 包能力变化：优先检查对应 `website/packages/*.md` 与根 `README.md`。

3. 处理生成资产

- 不手改以下生成文件：
  - `website/public/llms-index.json`
  - `website/public/seo-quality-report.json`
- 通过网站构建或对应脚本刷新它们。

4. 控制改动范围

- 只修改受影响入口，不做无关文案重写。
- 如果只是 skill 或 AI 入口同步，不要顺手大改其他章节结构。

5. 验证顺序

- 先做快速校验：
  - `pnpm skills:check:yaml`
  - `pnpm skills:score:json`
- 涉及 `website/**` 或生成资产时，再执行：
  - `pnpm --filter website-weapp-vite build`

## 约束

- 不要把生成资产当作人工维护文件直接编辑。
- 不要只更新单个页面而遗漏其他入口页。
- 不要在未核对源码前直接根据旧文案扩写。
- 不要把“技能清单更新”与“技能触发回归基线”拆开处理。
- 不要漏掉 `guide/index`、`what-is-weapp-vite`、`handbook`、`troubleshoot` 这类高频入口。

## 输出要求

应用本 skill 时，输出必须包含：

- 代码能力变化点。
- 受影响的文档/站点入口列表。
- 具体修改文件。
- 验证命令与生成产物说明。

## 完成检查

- 关键文档入口与实际实现一致。
- skill 清单、安装方式、调用示例没有过期信息。
- `wv` / `weapp-vite` 双命令、`dist/docs`、`AGENTS.md`、screenshot / ide logs 等 AI 入口没有文档漂移。
- `create-weapp-vite` 的 AI skills 安装、`AGENTS.md` 生成、`weapp-vite compare`、MCP explicit screenshot tools 已同步到公开入口。
- 公开 skills 的推荐安装方式（远程安装或本地 `skills:link`）与当前仓库事实一致。
- 如新增/调整 skill，回归清单与评分脚本已同步。
- 如涉及网站内容，`website` 已成功构建。
- 生成资产已通过脚本刷新，而不是手工拼写。

## 参考资料

- `references/docs-sync-checklist.md`
