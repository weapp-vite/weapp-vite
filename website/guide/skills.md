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

按项目需要选择构建、Vue SFC、Wevu 或 React 技能。

## 手动安装

适用于 npm、Yarn 和各版本 pnpm，无需为安装 skills 升级包管理器。按项目模板选择一条命令：

```sh
# 原生（包括 TailwindCSS、TDesign、Vant、原生多平台）
npx --yes skills add sonofmagic/skills --skill weapp-vite-best-practices

# Wevu / Vue SFC（包括 Wevu TDesign、插件、组件库、多平台 SFC）
npx --yes skills add sonofmagic/skills --skill weapp-vite-best-practices weapp-vite-vue-sfc-best-practices wevu-best-practices

# React
npx --yes skills add sonofmagic/skills --skill weapp-vite-best-practices weapp-vite-react-best-practices
```

`--yes` 只确认 npx 下载命令包，agent 和安装目录仍由 skills 安装器询问。`create-weapp-vite` 默认跳过 skills 安装；启用后只执行当前模板对应的列表。

迁移项目时可额外安装：`npx skills add sonofmagic/skills --skill native-to-weapp-vite-wevu-migration`。文档、发布和 E2E 维护技能不是普通项目的默认项；本仓库贡献者可用 `pnpm skills:link` 链接本地维护技能。

## 随依赖安装

pnpm 从 12.11.0 支持随直接依赖安装 skills，让技能内容跟随依赖版本更新。手动安装和随依赖安装使用同一份技能正文，但手动安装的版本由原安装器管理。

| 直接依赖包 | 随包 skills |
| --- | --- |
| `weapp-vite` | `weapp-vite-best-practices`、`weapp-vite-vue-sfc-best-practices` |
| `wevu` | `wevu-best-practices` |
| `@weapp-vite/react` | `weapp-vite-react-best-practices` |

这三个包不携带文档、发布或 E2E 维护技能；`@weapp-agent/cli` 另行发布 `weapp-acceptance`。

在项目或 workspace 根的 `pnpm-workspace.yaml` 中指定目录，再安装并审批：

```yaml
skills:
  dirs:
    - .agents/skills
```

```sh
pnpm install
pnpm approve
```

在交互式 `pnpm approve` 中审阅所需 skills 和构建脚本等权限。链接由 pnpm 管理；脚手架不会自动审批，也不通过 consumer `postinstall` 复制 skills。新建独立项目已预设 `.agents/skills`，不预授权；已有项目和团队 workspace 的配置保持不变。

**版本差异：**本仓库固定的 pnpm 12.18.0 支持交互选择 skill 名称，默认链接名不带包名前缀，冲突时回退为 `pnpm-<package>-<skill>`；12.11.0 / 12.16.1 使用包级审批和固定前缀。请在 AI 客户端使用实际链接名。

`permissions.<package>.skills: true` 允许该包全部及以后新增的 skills；带包名的 `pnpm approve <package>` 会批准该包全部能力和 skills，不等同于交互选择。

- 只发现本次安装包含的直接依赖，不扫描传递依赖；`pnpm install --prod` 不包含开发依赖中的 skills。
- workspace 内同一包统一使用最高版本的 skills，不按项目分别链接；最高版本不携带 skills 时，也不会使用旧版的 skills。
- 手工条目不会被覆盖。若链接名无法避开冲突，安装会停止。随包目录保持平铺，兼容上述版本。

自定义目录、发现深度、非本地安装限制见 [pnpm Agent Skills 文档](https://raw.githubusercontent.com/pnpm/pnpm/v12.18.0/pnpm/docs/agent-skills.md)；tarball / git 依赖需按来源审批，详见 [permissions 文档](https://raw.githubusercontent.com/pnpm/pnpm/v12.18.0/pnpm/docs/cli/permissions.md)。

### 撤销与清理

将对应包的 `permissions.<package>.skills` 改为 `false`，保留其他权限，再运行 `pnpm install`；不再使用的依赖可用 `pnpm remove <package>` 移除。审批撤销、依赖移除或新版不再提供该 skill 时，pnpm 只清理自建链接，保留手工内容。手动安装的 skills 仍由原安装器管理；不要批量删除 `.agents/skills`、`.claude/skills` 或自定义目录。

## 公开 Skills 速查

下面包含消费项目和仓库维护技能，按任务选用，不必全部安装。

| Skill                                   | 适用任务                                                                            | 优先读取                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `$weapp-vite-best-practices` | 配置、构建、分包、路由和 CLI | `node_modules/weapp-vite/dist/docs/` |
| `$docs-and-website-sync`                | 根据真实实现同步 `website`、README、skills、AI 指南和随包 `dist/docs`               | 源码、CLI、类型定义、`packages/weapp-vite/docs/**`、`website/.vitepress/**`  |
| `$release-and-changeset-best-practices` | pnpm change intent、repoctl 发布检查、GitHub issue 修复、worktree 与 PR 闭环        | `repoctl.config.ts`、`.changeset/**`、`e2e-apps/github-issues`、发布检查脚本 |
| `$weapp-devtools-e2e-best-practices`    | `e2e/ide/**`、automator 复用、`miniProgram.reLaunch(...)`、真实运行时截图和日志验收 | `e2e/ide/**`、`e2e/scripts/**`、DevTools 配置                                |
| `$weapp-vite-vue-sfc-best-practices`    | 小程序 `.vue`、JSON 宏、`definePageMeta`、layout、`v-model`、模板兼容               | `.weapp-vite` 类型文件、Vue SFC 文档、模板兼容清单                           |
| `$weapp-vite-react-best-practices` | React 渲染、事件和原生组件桥接 | 技能内 `references/`、`@weapp-vite/react` 公开类型 |
| `$wevu-best-practices` | 生命周期、响应式、事件、store 和 router | 技能内 `references/`、Wevu 文档 |
| `$native-to-weapp-vite-wevu-migration`  | 原生小程序迁移到 `weapp-vite + 原生`，或继续升级到 `weapp-vite + wevu + Vue SFC`    | 路线选择、迁移清单、API 映射、回滚与验收计划                                 |


## 维护公开 Skills

项目级 `AGENTS.md` 的规则源在 `scripts/agents/`；修改后运行 `pnpm agents:generate` 和 `pnpm agents:check`。用户定制规则放在 `AGENTS.local.md`。

新增、删除或合并 skill 时，需要同步这些入口：

| 入口                                                | 需要同步的内容                                |
| --------------------------------------------------- | --------------------------------------------- |
| `skills/<name>/SKILL.md`                            | skill 正文、触发场景、输出要求                |
| `skills/<name>/agents/openai.yaml`                  | display name、short description、隐式触发提示 |
| `skills/distribution.json`                         | 唯一消费包 owner，以及不随三个消费包发布的按需/贡献者分类 |
| `skills/skill-trigger-regression-checklist.md`      | 主用例、边界用例、冲突场景                    |
| `skills/scripts/score-skill-trigger-regression.mjs` | 预期 skill 映射与统计分组                     |
| `skills/scripts/check-public-skill-sync.mjs`        | 公开目录、元数据、评分映射与入口一致性检查    |
| `website/guide/skills.md`                           | 对外索引、任务路由和关联文档                  |
| `website/guide/ai.md` 与 `/ai` 页面                 | 安装方式和公开 skill 清单                     |
| `CLAUDE.md` / 脚手架 `AGENTS.md` 模板               | AI 客户端可见的默认清单                       |

完成后至少运行：

```sh
pnpm skills:check
pnpm skills:score:json
pnpm seo-quality-check
```

随包内容或归属变化时，还需运行真实打包与消费验收：

```sh
pnpm exec turbo run build --filter=weapp-vite... --filter=wevu... --filter=@weapp-vite/react...
node skills/scripts/verify-package-skills.mjs
```

验收使用真实 npm tarball 和独立消费目录；可通过 `PNPM_SKILLS_BIN` 指定 pnpm 版本。脚手架模板验收单独运行。

## 关联阅读

1. [AI 协作指南](/guide/ai)
2. [AI 任务工作流](/guide/ai-workflows)
3. [CLI 命令参考](/guide/cli)
4. [@weapp-vite/mcp 包说明](/packages/mcp)

## 改动验收

使用 [小程序改动验收](./acceptance) 和 `weapp-acceptance` Skill，通过现有 MCP 完成检查、场景运行和报告读取，无需第二个模型。
