# 真实 SFC 编译入口 profile

本工具只测 built 公开 `compileVueFile` 的一次完整 awaited 调用，不复刻内部阶段。它覆盖八个未经改写的仓库 SFC，包括普通 Wevu 页、Tailwind/TDesign 组件、组件注册 fixture 和一个不应消费 compiler batch 的控制样本。普通原生小程序没有此入口；本结果不能代表完整 CLI 构建、HMR、最终 Tailwind CSS 或宿主 runtime 性能。

## 准备与运行

先安装锁文件依赖，再单独准备 release addon 与新鲜包产物：

```sh
pnpm install --frozen-lockfile
pnpm exec tsx scripts/astMigrationProfile/prepare.ts
pnpm exec tsx scripts/ast-migration-profile.ts
```

prepare 串行执行 `@weapp-vite/ast-native native:build -- --locked`、相关包闭包的强制构建，再使用刚构建的 `dist/cli.mjs prepare` 为五个唯一工程各同步一次 `.weapp-vite` 支持文件，显式沿用各工程 config 和 weapp platform。CLI prepare 本身容错，工具还要求成功日志并拒绝跳过，不能只凭退出零接受结果。回执记录实际命令、仓库相对 cwd 和 Node 版本；只有全部成功且 fixture/源码未漂移才生成 ignored build receipt。采样前必须核对 receipt 与当前 commit、源码、项目输入、锁文件、built dist、全部生成支持文件和 addon hash 一致。支持文件、工具或产物发生变动后须重新 prepare。prepare 和 collection 使用仓库机器租约，并等待取消的当前子进程退出后再释放租约；执行者仍需确认没有归属不明的外部 watcher/E2E。

无参命令固定 40 个 pair，支持 `--trials=N`（不得少于 40）、`--output=...`、`--addon=...` 和 `--build-receipt=...`。`--diagnostic` 为兼容参数；独立诊断 pass 始终执行，不能通过省略参数绕过 batch 消费验证。非默认 addon 也必须匹配准备回执。

默认报告在 `.tmp/real-compiler-entry-profile/report.json`。失败保留已完成样本、失败 cell 和原始原因，状态为 failed；不完整或 parity 失败的结果不生成性能 summary。

## 采样边界

每个 cell 使用新鲜子进程，偶数 trial 先 off 后 on，奇数反转，所有 worker 串行运行。native on 使用真实 release `.node`；wall 进程没有代理、强制 GC、inspector 或调用计数钩子。

生产 options 来自真实项目配置、`createCompileVueFileOptions`、Vite resolver 和其他项目组件的 auto-import registry；支持文件输出被禁用。registry 明确排除目标组件，准备阶段没有调用目标的 `compileVueFile` 或 compiler 私有 `readAndParseSfc` descriptor cache。其他组件的 Vue parse/props/config 分析可能预热共享依赖，因此 cold 表示完成配置和 registry 准备后的目标首次完整编译，不是全进程或整个工程冷启动，也不清空 OS 文件缓存。

配置由生产 config service 的 runner 加载并合并，避免单独使用 Vite 默认 bundle loader 将无 `type: module` 项目的 ESM 配置误作 CommonJS。每个 worker 保存实际 `optionsSummary`；函数只记录存在标记，不把函数本身序列化。Vite `createResolver` 仅覆盖内建文件/alias 解析，未运行自定义 plugin `resolveId` 链；本工具八个固定输入没有此类 resolver 插件，不能据此承诺其他插件工程的解析兼容。

warm 同样使用独立子进程和相同 options，先执行两次完全相同的目标编译，再测第三次；不改 source、filename 或 sourcemap 来规避缓存。导入、配置准备和首次原始 addon require 分别记录 `importMs`、`preparationMs`、`addonLoadMs`。addon require 包括加载/初始化，在 off 中为零，不计入 `compileMs`。

八 fixture × 两种 sourcemap × cold/warm × 40 pair × off/on = **2560 个有效 wall 样本**，两次 warmup 不计入样本。全部 wall 完成后，另收集 **64 个诊断样本**，其耗时不进入 P50/P95。

summary 按 fixture、cold/warm 和 sourcemap 分组给出两 arm 的 compile P50/P95、addon load P50/P95、进程 peak RSS P50/P95，以及同 trial 配对耗时减少比例中位数。RSS 包括 import/preparation，不能解释为 compiler 独占内存或 retained allocation；不得将不同 fixture 的中位数相加当作工程总时间。

## 输出与计数

每个同 fixture/sourcemap 条件的原始 outcome 在所有 arm、cold/warm 和诊断 pass 之间严格 `isDeepStrictEqual` 比较，然后才做报告脱敏。校验包括 script/template/style/config、完整 map 与 sourcesContent、metadata、warning 顺序和错误 code/location/cause；只省略不稳定 stack。V8 序列化保留 undefined 等 JSON 无法保存的原始字段。

原始 outcome 保存为报告旁的 `.raw/*.bin` 内容寻址文件，报告引用 hash。这些本地原始结果可能含机器路径，发布前必须单独隐私检查；JSON 报告脱敏不等于 raw 文件已脱敏。

诊断 pass 代理实际 CJS Babel/SFC export 和真实 native binding，记录可观察的 parse/traverse/generate 调用、跨界次数、batch 输入/唯一输入/校验拒绝项与 native thrown calls。诊断输出必须与 wall 原始 addon 输出精确一致；hook 未覆盖的 ESM/internal 调用不计入这些可观察计数，正式采样前需要实际 worker preflight 确认覆盖范围。

GC 只统计 `startTime` 位于实际 awaited 编译起止区间的事件，排除异步送达的准备或强制 GC。CPU 和 V8 sampled allocation 仅来自独立诊断 pass。

release addon 不暴露 Rust 内部 parse 或完整 JS fallback 计数，两列始终为 **null/不可用**，不能写成 `fallback=0`。目标样本要求实测 batch 消费、拒绝项和 thrown calls 为零；这只证明可观察 native 批量结果被接受，不能证明所有 fallback 路径。addon 缺失、throw、解析失败和无效摘要时完整 JS 路径只执行一次，需要独立 correctness suite 验证，本 profile 不替代该验收。

纯工具验证，不需要运行真实 worker 或 package build：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/ast-migration-profile.test.ts scripts/astMigrationProfile --maxWorkers=1 --no-file-parallelism
pnpm exec eslint scripts/ast-migration-profile.ts scripts/ast-migration-profile.test.ts scripts/astMigrationProfile
pnpm exec tsc -p scripts/astMigrationProfile/tsconfig.json --noEmit
```
