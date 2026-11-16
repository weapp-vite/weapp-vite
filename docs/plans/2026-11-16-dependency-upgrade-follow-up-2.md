# 2026-11-16 依赖升级 follow-up 记录（二）

本记录承接已合入主线的依赖升级记录，按低风险工具链优先的策略处理第二批候选。上一批 changeset 和历史计划保留原文；本记录只记录本批接受与暂缓的版本决策。

## 本批接受

| 依赖 | 采用版本 | 接受依据 |
| --- | --- | --- |
| `hono` | `^4.13.19` | patch 版本；仓库仅在 request-client server fixture 中使用 Hono，沿现有请求客户端和相关脚本测试验证。 |
| `repoctl` | `6.6.3` | engines、peer 范围未扩大；同步 `@icebreakers/monorepo`，并用原生生成器重新导出 release、snapshot 和 auto-changeset 相关工作流。 |
| `@icebreakers/eslint-config` | `8.0.20` | 与 Stylelint 配套版本同步，保留现有 ESLint、TypeScript 和 Vue 配置消费面。 |
| `@icebreakers/stylelint-config` | `6.0.5` | 与 ESLint config 成对升级，包含上游 `postcss-html` 和 Tailwind Stylelint 插件更新。 |
| `oxfmt` | `0.79.0` | 脚手架直接消费者的 engines、peer 和 `tinypool` 约束未扩大；更新脚手架精确版本并验证 Oxfmt 公共 exports、模板和 Vite+ consumer。 |

## 暂缓候选

- `vite@8.3.8`：历史 Web optimizer 关闭清理契约仍未通过，且现有 `patches/vite@8.3.5.patch` 绑定旧版本。
- `rolldown@1.3.2`：超出 Vite 8.3.8 官方 `rolldown~1.2.18` 范围，继续保持单版本策略。
- `vite-plus@1.6.0`：内置 Vite/Rolldown 组合仍受同一 Web optimizer 生命周期问题影响，另需完整 Vite+ consumer 矩阵。
- `typescript@7.0.2`：Volar、类型生成和 Compiler API 消费面尚缺 TypeScript 7 兼容证据，另行作为迁移项目评估。

## 同步范围

- `repoctl@6.6.3` 的 release、snapshot、auto-changeset 生成文件与 builder 摘要按原生生成器同步。
- auto-changeset 原生模板会把现有 `pr-ci-approval` 审批环境和工作流命名改为另一套契约；为保持仓库既有审批边界，本批保留定制工作流结构，只同步 `repoctl@6.6.3` 安装版本并完成对应契约验证。
- `@icebreakers/eslint-config` 与 `@icebreakers/stylelint-config` catalog 及脚手架生成 catalog 同步。
- `packages/create-weapp-vite` 的 Oxfmt 精确版本更新为 `0.79.0`。
- 依赖和 catalog 变更分别保留自动生成的两份 changeset，历史 changeset 不改写。
- Vite、Rolldown、Vite+、TypeScript 的声明和既有 patch 保持不变。

## 验证

- `pnpm install --frozen-lockfile --ignore-scripts` 通过；生成 catalog、changeset frontmatter、发布依赖协议、npm 包元数据、Tailwind catalog 和 Rolldown 单版本检查通过。
- Repoctl 6.6.3 原生 snapshot 生成器输出与提交的两份 workflow 逐字节一致，builder SHA256 更新为 `b1c157f4f56a60e6d0c31e94613fcda91be8cb891ce0a976fa5160b133a3ef36`；snapshot、release、bootstrap、auto-changeset 和审批契约共 392 项通过、1 项既定跳过。
- Hono request-client server 及开发插件测试 6 项通过；Vite+ consumer、public types 和脚手架 smoke 契约 29 项通过。
- `@weapp-vite/oxfmt` typecheck、test:types、50 项单测和 lint 通过；`@weapp-vite/eslint` typecheck、test:types、47 项单测和 lint 通过；`create-weapp-vite` typecheck、388 项测试和构建通过。
- 根 typecheck、根 ESLint、全部模板 ESLint 和模板 Stylelint 通过。peer 检查仍报告上一批已有的 Vite、webpack、graphql 和 mermaid 范围告警，没有新增本批特有告警。
