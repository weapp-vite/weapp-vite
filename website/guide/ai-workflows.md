---
title: AI 任务工作流
description: 将 Weapp-vite 常见 AI 协作任务拆成可执行流程，覆盖 issue 修复、文档同步、DevTools e2e、SFC 排障和原生迁移。
keywords:
  - Weapp-vite
  - AI
  - workflow
  - MCP
  - Skills
  - DevTools
  - e2e
date: 2026-05-03
---

# AI 任务工作流

本文把常见 AI 协作任务整理成“入口、事实源、执行步骤、验收信号”。如果你还不确定该先用哪个 skill，先看 [AI Skills 使用指南](/guide/skills)。

## 工作流总览

| 任务                      | 主 skill                                | 事实源                                                      | 验收信号                                |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| 同步网站和 skills 文档    | `$docs-and-website-sync`                | 源码、CLI、类型定义、随包 docs、VitePress 配置              | 相关入口一致，`seo-quality-check` 通过  |
| 修 GitHub issue           | `$release-and-changeset-best-practices` | issue 描述、最小复现、单测、e2e                             | 复现先失败后通过，changeset 判定清楚    |
| 调整项目配置或 CLI        | `$weapp-vite-best-practices`            | `vite.config.ts`、`packages/weapp-vite/src/**`、`dist/docs` | 目标包先 build，下游窄范围验证通过      |
| 排查 Vue SFC 编译或模板   | `$weapp-vite-vue-sfc-best-practices`    | `.vue`、JSON 宏、`.weapp-vite` 类型支持文件                 | `wv prepare` 后类型与产物一致           |
| 排查 wevu 运行时行为      | `$wevu-best-practices`                  | 生命周期、事件、store、router、运行时日志                   | 单测或 DevTools runtime 信号稳定        |
| 新增 DevTools e2e         | `$weapp-devtools-e2e-best-practices`    | `e2e/ide/**`、automator 会话、项目配置                      | suite 复用 automator，`reLaunch` 串场景 |
| 原生迁移到 Wevu / Vue SFC | `$native-to-weapp-vite-wevu-migration`  | 原生页面、迁移映射、回滚点、截图日志                        | 分波次迁移，每波有可回滚验收            |

## 文档同步

适用场景：

1. CLI、配置项、MCP、截图、日志或模板能力变化。
2. `website`、README、skills、`dist/docs` 或脚手架 `AGENTS.md` 出现不一致。
3. 新增、删除、合并 skill。

推荐流程：

1. 使用 `$docs-and-website-sync`。
2. 先查真实实现，不要在旧文案之间互相复制。
3. 按“能力变化 -> 公开入口”建立修改清单。
4. 同步 `website/guide/ai.md`、`website/guide/skills.md`、`website/.vitepress/components/AiLearningPage.vue` 和相关包说明。
5. 如果涉及随包文档，检查 `packages/weapp-vite/docs/**` 与 `packages/weapp-vite/scripts/sync-package-docs.mjs`。
6. 运行最小验证。

```sh
pnpm skills:check:yaml
pnpm seo-quality-check
pnpm --filter website-weapp-vite build
```

## GitHub issue 修复

适用场景：

1. 用户明确给出 GitHub issue。
2. 需要在 `e2e-apps/github-issues` 增加复现。
3. 修复会影响运行时、构建行为或用户可见输出。

推荐流程：

1. 使用 `$release-and-changeset-best-practices`。
2. 按仓库规则在 `.codex-tmp/<issue>` 创建本地 worktree。
3. 先补最小复现，确认修复前失败。
4. 再分析根因并修改对应包。
5. 包源码变化后，先重建 touched package，再做下游验证。
6. 判断是否需要 changeset；行为修复通常需要。
7. 本地验证完成后开中文 PR。

验收输出应包含：

| 项   | 要求                         |
| ---- | ---------------------------- |
| 复现 | 说明新增的最小用例和失败信号 |
| 修复 | 说明根因和修改文件           |
| 验证 | 列出实际运行的窄范围命令     |
| 发布 | 说明 changeset 和 PR 状态    |

## DevTools runtime 验收

适用场景：

1. 需要真实微信开发者工具运行时信号。
2. 需要截图、截图对比、console 日志或页面结构检查。
3. 需要新增 `e2e/ide/**` 用例。

推荐流程：

1. 使用 `$weapp-devtools-e2e-best-practices`。
2. 先确认没有残留 E2E、DevTools 或 watch 进程。
3. 同一个 app suite 内只启动一次 automator。
4. 多页面场景通过 `miniProgram.reLaunch(...)` 切换。
5. 截图优先用 `wv screenshot` 或 `take_weapp_screenshot`。
6. 日志优先用 `wv ide logs --open` 或 MCP DevTools runtime tools。

```sh
wv screenshot --json
wv compare --json
wv ide logs --open
```

## SFC 与 wevu 排障

如果主问题是 `.vue` 宏、模板编译、`v-model` 或 `usingComponents`，优先使用 `$weapp-vite-vue-sfc-best-practices`。

执行顺序：

1. 先读项目根 `AGENTS.md` 和本地 `node_modules/weapp-vite/dist/docs/vue-sfc.md`。
2. 检查 `definePageJson`、`definePageMeta`、`usingComponents` 和 `<json>` 是否职责混杂。
3. `.weapp-vite` 类型文件漂移时先执行 `wv prepare`。
4. 再做页面级或组件级验证。

如果主问题是生命周期、store、事件、router、页面切换或性能，优先使用 `$wevu-best-practices`。

执行顺序：

1. 确认生命周期注册是否同步发生在 `setup()` 内。
2. 检查 store 解构是否使用 `storeToRefs`。
3. 检查事件 `detail` 与小程序事件契约是否稳定。
4. 性能问题先找高频 `setData`、滚动事件、资源缓存和页面切换链路。

## 原生迁移

适用场景：

1. 原生 `Page/Component` 要逐步迁移到 Vue SFC。
2. 迁移期间必须可回滚。
3. 迁移后需要 AI 能继续稳定维护项目。

推荐流程：

1. 使用 `$native-to-weapp-vite-wevu-migration`。
2. 先拆波次，不把机械迁移和语义升级混在同一轮。
3. 每波迁移前记录页面入口、原生 API、事件契约和回滚点。
4. `properties/observers/triggerEvent` 分别映射到 `defineProps/watch/defineEmits`。
5. 迁移后补截图、日志或 e2e 验收，并更新项目 AI 指引。

## 给 AI 的统一交付格式

```text
请按 weapp-vite 项目规则处理这个任务。
输出必须包含：
1. 使用的主 skill 和必要的次 skill。
2. 先读取的事实源。
3. 修改的文件。
4. 执行的验证命令。
5. 未执行验证时说明原因。
```

## 关联阅读

1. [AI 协作指南](/guide/ai)
2. [AI Skills 使用指南](/guide/skills)
3. [CLI 命令参考](/guide/cli)
4. [调试与贡献](/guide/debug)
