# 2026-11-11 全仓依赖升级

## 范围与版本冻结

从同步后的 `main` 提交 `4930bf7f3ca4d48c720ab221c566c1f462949f1f` 开始，评估 npm 工作区、模板、网站、扩展、独立 miniprogram-ci runner、Cargo、Actions 和固定工具链。npm 候选在 2026-11-11 06:22 UTC 冻结，Cargo、Actions 和工具链在同轮官方查询后冻结，验证期间不追逐新发布。

使用 Node 24.22.2、pnpm 12.18.0、Rust 1.99.1。Node、pnpm、Rust、Bun 1.4.4 及其余九组 Actions 保持当前版本。公开 peer 最低兼容范围、历史 fixture、第三方 upstream 和性能基线保持原用途。

| 依赖 | 升级前 | 升级后 |
| --- | --- | --- |
| ai | 7.0.166 | 7.0.169 |
| @ai-sdk/anthropic | 4.0.99 | 4.0.102 |
| @ai-sdk/openai | 4.0.111 | 4.0.114 |
| @ai-sdk/openai-compatible | 3.0.87 | 3.0.90 |
| @inquirer/prompts | 8.7.5 | 8.8.0 |
| sass、sass-embedded | 1.108.1 | 1.108.2 |
| solid-js | 1.9.18 | 1.9.19 |
| vite-imagetools | 12.0.1 | 12.0.2 |
| vitepress-plugin-llms | 1.14.0 | 1.15.0 |
| vue-router | 5.4.0 | 5.5.0 |
| weapp-tailwindcss | 5.7.3 | 5.7.4 |
| napi | 3.16.1 | 3.16.2 |
| napi-derive | 3.7.0 | 3.7.1 |
| peter-evans/create-pull-request | v8.1.2 | v8.1.3 |

两处 create-pull-request 固定官方 tag 解引用后的 commit `3ffccacd46053766916f087ce41d627c0b8cf2d1`。保留 catalog、精确版本、`^` 和 `~` 的声明形式；同步脚手架生成 catalog 与现行初始化 fixture。依赖和 catalog 发布记录由仓库现有生成器生成中文 patch changeset，包含 `create-weapp-vite`。

Cargo.lock 同时刷新父依赖允许的 itoa、smallvec、syn 和 napi-derive-backend。npm 锁文件去重后 package 条目由 2901 减至 2878；独立 runner 的 package-lock 同步刷新，miniprogram-ci 仍为 2.1.31。

## 保留项与编译链候选

- TypeScript 保留用户选择的 6.0.3；7.x 不再提供现有编译链需要的旧 Compiler API。
- local-pkg 保留 1.2.1；2.0.0 官方声明文件仍引用未定义的 `Args`。
- VitePress 2.0.0-alpha.20、vite-tsconfig-paths 7.0.0-alpha.3 保持已有预发布基线，不降级。
- 官方 Vite 8.3.5 / Rolldown 1.2.16、Vite+ 1.5.0 保留。旧配对的既有豁免没有用于新候选。

候选安装在隔离目录，解析 hook 明确指向相应官方入口；Vite+ 使用实际 core 与内置 Rolldown，未替换为独立 Vite。执行原六项产品契约与原资源所有权边界，保留原断言和失败退出码。

| 候选 | 实际引擎 | 原始产品结果 | 收尾 |
| --- | --- | --- | --- |
| Vite 8.3.8 | Vite 8.3.8 / Rolldown 1.2.18，满足官方 `~1.2.18` | hooks、resolver、mini-optimizer 通过；web-optimizer 失败；polling、ready 未执行 | fixture、scope、租约确认终结 |
| Vite+ 1.6.0 / core 1.6.0 | 内置 Vite 8.3.7 / Rolldown 1.2.18 | hooks、resolver、mini-optimizer 通过；web-optimizer 失败；polling、ready 未执行 | fixture、scope、租约确认终结 |

两组均在取消 Web 扫描并关闭 server 后残留 `deps_temp_*` 缓存目录，扫描中关闭和请求空闲后关闭均失败，因此拒绝升级。未修改测试、豁免或清理门限。

逐份核对现有三份补丁后全部保留：Chokidar 6.0.0 的监听生命周期、plugin-vue 6.0.10 的 Oxc 上下文、Vite 8.3.5 内置 Chokidar 的 ready 计数。修正 `patches/README.md` 中遗漏 Vite 补丁及过时 repoctl 版本的说明。

## 安全与 peer

工作区升级前后均为 low 8、moderate 23、high 18、critical 8；57 条 advisory 的身份集合没有新增或修复。保留逐条 advisory、受影响版本及依赖路径对比，不使用跨大版本 override 强制清零。

遗留路径主要包括：minidev 的 request、download、tar 链；cos-wx-sdk-v5 固定的 fast-xml-parser 4.5.0；miniprogram-simulate 的 PostCSS 7；旧 oxfmt 固定的 tinypool 2.1.0；第三方 weapp-sqlite 的 Vite 8.3.2；Monaco 固定的 DOMPurify 3.4.15。它们受父依赖版本或固定依赖约束，须由父包升级或独立兼容迁移处理。

独立 runner 的 npm audit 前后均为 low 1、moderate 15、high 19、critical 40，共 75 个受影响包；该统计按 npm 聚合包计数，与工作区 pnpm advisory 计数口径不同。

基线锁文件和升级后锁文件的 `pnpm peers check` 输出完全一致：Vite+ alias 的版本识别、webpack/schema-utils、graphql-request、第三方 Vite/devtools 及 Mermaid/VitePress 的既有告警保留，本轮未新增 peer 告警。

## 验证记录

本地证据索引为 `.tmp/current-run/dependency-upgrade-2026-11-11/state.json`；命令、时间、退出码与独立日志登记于同目录 `checks.jsonl`，版本与 advisory 逐项记录分别为 `registry.json`、`ecosystem.json`、`graph-comparison.json`。

关联单测 91 文件、825 项通过；native correctness 9 文件、183 项通过；native release 构建通过。全量包构建 49 项通过；串行重建后依赖产品契约、应用/模板构建和网站构建通过；5 个受影响包 typecheck、88 项公开类型检查、全仓 ESLint 和 changeset 检查通过。

全量单测首轮有 31 项超时或资源等待失败；24 个失败文件单 worker 重跑 219 项全部通过，随后 4 worker 全量重跑通过：2,704 个测试文件、26,201 项。native 六个既有 SFC 的输出与 Babel 基线逐项一致；性能 P95 有波动，没有证据支持扩大 native 默认启用范围。

完整 headless suite 于 2026-11-11 08:35 UTC 结束，退出码 0：112 项清单中 98 项在范围内全部通过，14 项按既有产品范围排除；失败、阻塞、跳过和未执行均为 0。完整汇总见 `docs/reports/2026-11-11-163547-e2e-ide-headless-full-classic-f7995aea-suite-report/index.md`。

首轮应用构建、包类型检查和既有编译链产品检查受到并行 Turbo 任务清理共享 dist 的影响，出现缺文件错误；该轮失败保留，串行重跑结果单独记录，不能将缺失产物直接归因为依赖回归。

正式 IDE 验收须在提交推送后，从同步、干净的根 `main` 运行；当前提交的适用跨平台 CI 也须在推送后跟踪完成。二者尚未完成，**未完成最终验收**。
