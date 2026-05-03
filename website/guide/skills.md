---
title: AI Skills 使用指南
description: 按任务场景选择 Weapp-vite 公开 Skills，说明安装方式、触发边界、关联文档和最小验证命令。
keywords:
  - Weapp-vite
  - AI
  - Skills
  - Codex
  - Claude Code
  - guide
  - 工作流
date: 2026-05-03
---

# AI Skills 使用指南

`Skills` 用来把仓库里的工程约束、验证路径和交付规则注入给 AI。它解决的不是“让 AI 多知道一个名词”，而是让 AI 在具体任务里按稳定流程工作。

## 什么时候需要安装

| 场景                                | 推荐动作                                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| 新项目通过 `create-weapp-vite` 创建 | 在脚手架交互提示里选择安装推荐 skills                          |
| 已有项目接入 `weapp-vite`           | 手动执行 `npx skills add sonofmagic/skills`                    |
| 直接维护本 monorepo                 | 执行 `pnpm skills:link`，同步 `skills/*` 与 `.claude/skills/*` |
| 只想查看链接结果                    | 执行 `pnpm skills:link:dry`                                    |

```sh
npx skills add sonofmagic/skills
pnpm skills:link
pnpm skills:link:dry
```

## 公开 Skills 速查

当前公开分发的 skill 以仓库 `skills/*/SKILL.md` 为准：

| Skill                                   | 适用任务                                                                            | 优先读取                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `$weapp-vite-best-practices`            | `vite.config.ts`、分包、chunk、自动路由、CLI、MCP、DevTools 命令归属                | 根 `AGENTS.md`、`node_modules/weapp-vite/dist/docs/`、`website/config/**`   |
| `$docs-and-website-sync`                | 根据真实实现同步 `website`、README、skills、AI 指南和随包 `dist/docs`               | 源码、CLI、类型定义、`packages/weapp-vite/docs/**`、`website/.vitepress/**` |
| `$release-and-changeset-best-practices` | changeset 判断、发布检查、GitHub issue 修复、worktree 与 PR 闭环                    | `.changeset/**`、`e2e-apps/github-issues`、发布检查脚本                     |
| `$weapp-devtools-e2e-best-practices`    | `e2e/ide/**`、automator 复用、`miniProgram.reLaunch(...)`、真实运行时截图和日志验收 | `e2e/ide/**`、`e2e/scripts/**`、DevTools 配置                               |
| `$weapp-vite-vue-sfc-best-practices`    | 小程序 `.vue`、JSON 宏、`definePageMeta`、layout、`v-model`、模板兼容               | `.weapp-vite` 类型文件、Vue SFC 文档、模板兼容清单                          |
| `$wevu-best-practices`                  | wevu 生命周期、事件、store、router、layout、运行时性能治理                          | `packages-runtime/wevu`、wevu 文档、运行时排障清单                          |
| `$native-to-weapp-vite-wevu-migration`  | 原生 `Page/Component` 迁移到 `weapp-vite + wevu + Vue SFC`                          | 迁移清单、API 映射、回滚与验收计划                                          |

## 任务路由建议

| 用户意图                                     | 主 skill                                | 常见次 skill                                           |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| “帮我调分包、chunk、自动路由或 CLI”          | `$weapp-vite-best-practices`            | `$weapp-vite-vue-sfc-best-practices`                   |
| “根据当前实现更新 website / skills / README” | `$docs-and-website-sync`                | `$weapp-vite-best-practices`                           |
| “这个 issue 要按仓库流程修完并开 PR”         | `$release-and-changeset-best-practices` | `$wevu-best-practices` 或 `$weapp-vite-best-practices` |
| “新增 DevTools runtime e2e 或截图验收”       | `$weapp-devtools-e2e-best-practices`    | `$weapp-vite-best-practices`                           |
| “`.vue` 宏、模板或 `usingComponents` 不生效” | `$weapp-vite-vue-sfc-best-practices`    | `$weapp-vite-best-practices`                           |
| “wevu 生命周期、store 或页面切换行为异常”    | `$wevu-best-practices`                  | `$weapp-vite-vue-sfc-best-practices`                   |
| “原生页面逐步迁移到 Vue SFC / wevu”          | `$native-to-weapp-vite-wevu-migration`  | `$wevu-best-practices`                                 |

## 给 AI 的推荐提示词

```text
请先判断本任务应该使用哪个 weapp-vite skill。
如果任务涉及当前安装版本，请优先读取 node_modules/weapp-vite/dist/docs/。
如果任务涉及真实小程序运行时截图、截图对比或日志，请优先使用 wv screenshot、wv compare、wv ide logs --open 或对应 MCP tools。
最后请给出：使用的 skill、改动文件、验证命令和结论。
```

## 维护公开 Skills

新增、删除或合并 skill 时，需要同步这些入口：

| 入口                                                | 需要同步的内容                                |
| --------------------------------------------------- | --------------------------------------------- |
| `skills/<name>/SKILL.md`                            | skill 正文、触发场景、输出要求                |
| `skills/<name>/agents/openai.yaml`                  | display name、short description、隐式触发提示 |
| `skills/skill-trigger-regression-checklist.md`      | 主用例、边界用例、冲突场景                    |
| `skills/scripts/score-skill-trigger-regression.mjs` | 预期 skill 映射与统计分组                     |
| `website/guide/skills.md`                           | 对外索引、任务路由和关联文档                  |
| `website/guide/ai.md` 与 `/ai` 页面                 | 安装方式和公开 skill 清单                     |
| `CLAUDE.md` / 脚手架 `AGENTS.md` 模板               | AI 客户端可见的默认清单                       |

完成后至少运行：

```sh
pnpm skills:check:yaml
pnpm skills:score:json
pnpm seo-quality-check
```

## 关联阅读

1. [AI 协作指南](/guide/ai)
2. [AI 任务工作流](/guide/ai-workflows)
3. [CLI 命令参考](/guide/cli)
4. [@weapp-vite/mcp 包说明](/packages/mcp)
