# Rust 原生编译链性能调研

日期：2026-11-25

## 结论

当前 Rust 代码覆盖 `@weapp-vite/ast-native` 的可选 Oxc AST 分析和编译器脚本摘要。Vue 模板编译、完整脚本转换、代码生成、sourcemap、Vite/Rolldown 模块图和宿主 runtime 仍由现有 JavaScript 工具链负责。

现有证据支持以下判断：

- AST 局部分析可以获得数量级收益。固定分析样本中，组合分析的 JS 基线为 5.215 ms，Rust 为 0.197 ms。直接批量调用为 0.110 ms，8 份源码批量调用为 0.803 ms。
- 真实 `compileVueFile` 入口的收益通常落在低个位数到约 11% 的 P50 区间，且依赖 fixture、冷暖状态、sourcemap 和当时的 JS 基线。P95 存在噪声和退化样本。
- 当前没有通过完整 CLI 构建或 HMR 性能门禁的稳定 Rust 收益数字。已有 HMR profile 显示计时主要落在 bundler，但这些 profile 没有隔离 native on/off，因此不能把 HMR 耗时归因于 Rust。
- 默认保持 native 显式启用和 JS fallback。完整脚本阶段的 Rust POC 是下一项最有价值的性能实验。

## 当前实现边界

native 入口要求显式配置 `WEAPP_VITE_NATIVE=1` 和 `WEAPP_VITE_NATIVE_AST_PATH`。npm chunk 分析还要求 `WEAPP_VITE_NATIVE_NPM_CHUNK=1`。加载失败、Rust 解析失败、摘要校验失败和未支持输入都会回到原有 Babel/Oxc 路径。

编译器批量入口一次接收多份脚本，Rust 对相同源码只解析一次并返回摘要。摘要用于导入、宏、组件注册和保留属性诊断等前置判断，完整语义仍由原有编译器确认。这个边界控制了跨 JavaScript 与 Rust 的通信次数，也限制了可直接节省的总耗时。

相关实现位于：

- `packages/ast/src/native.ts`
- `packages/ast-native/src/compiler_analysis.rs`
- `packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/nativeAnalysis.ts`

## 性能证据

### AST 局部批处理

2026-10-11 的固定 profile 使用 Rust 1.99.0 release addon，包含 160 次测量和 20 次预热。该实验只测分析边界，不能外推到完整 SFC 或工程构建。

| 操作 | JS | Rust | 说明 |
| --- | ---: | ---: | --- |
| 组合分析 | 5.215 ms | 0.197 ms | 约 26.5 倍，属于局部分析路径 |
| 直接批量调用 | - | 0.110 ms | 单次 native 边界 |
| 8 份源码批量调用 | - | 0.803 ms | 约 0.100 ms／份，批量摊薄边界成本 |

这组结果证明批量 API 设计有效。它没有覆盖 Babel 生成、Vue 模板编译、文件 I/O 或模块图构建。

### 真实 `compileVueFile` 入口

历史 profile 逐步扩大了输入和采样范围。所有通过的轮次都逐次比较代码、完整 sourcemap、`sourcesContent`、metadata、warning 顺序以及错误位置。

| 采样记录 | 规模 | 观察结果 | 范围限制 |
| --- | --- | --- | --- |
| 2026-10-15 | 6 份 SFC，480 次测量 | P50 从改善 10.19% 到回退 3.51%；P95 从改善 17.62% 到回退 17.73% | warm `compileVueFile`，不含 CLI、HMR、Tailwind CSS 和 runtime |
| 2026-10-26 | 6 份 SFC，480 次测量，120 次预热 | 5 个场景 P50 降低 7.21%–10.71%；slot 场景 P50 增加 2.56%，P95 增加 100.52% | 另一组冻结输入和绑定版本，不能与其他 profile 相加 |
| 2026-11-10 | 6 份 SFC，每份 10 次预热和 40 对交替采样 | 暖入口 P50 改善 0.14%–11.04%，P95 仍有噪声和退化样本 | 输出保持一致，仍未覆盖完整构建和 HMR |

历史记录中的百分比使用两种记法：10-15 和 11-10 以负值表示 native 更快；10-26 直接报告耗时降低。表格已统一为“改善／回退”表述。

2026-10-31 的完整入口 profile 扩展为 8 份真实 SFC，覆盖 cold/warm、sourcemap 开关和 native 开关，共 2,560 个 wall 样本与 64 个诊断样本。该轮确认了完整 `compileVueFile` 调用的严格 parity 和 native batch 消费，仍不能代表完整 CLI 工程。

### 完整构建与 HMR

历史 commit `0306700fd` 的 TDesign smoke 曾观察到约 8.75% 的 wall P50 降低，但只有两组配对样本，且产物 sourcemap 存在差异，因此状态为 incomplete，不能作为性能门禁结果。

正式 HMR 记录中的功能场景可以全部通过，而 bundler 计时仍有失败场景。`compileVueFile` 的局部收益无法直接转换为 HMR 总耗时收益，后续需要在同一入口中分别记录 native 命中率、脚本阶段、模板阶段、bundler 和 watcher 时间。

### 2026-11-25 编译器批量页面特性 POC

本轮在当前主线输入上重新执行了 8 个真实 SFC、cold/warm、sourcemap 开关和 native on/off 的 40 对交替采样，共 2,560 个 wall 样本和 64 个 diagnostic 样本。Rust visitor 在同一次 Oxc parse/traverse 中收集页面特性 import、调用顺序和去重后的 feature flags，`transformScript` 直接消费摘要。native 不可用、摘要校验失败或输入不支持时仍走原有 Babel 路径。

主要 warm fixture 的 14 个条件（7 个 fixture、2 个 sourcemap 设置）中，7 个条件的 P50 至少改善 5%，改善范围为 5.30%–16.04%；其余条件在 -3.32% 到 4.16% 之间。最大 P95 回退为 16.60%，出现在 `script-setup` 的 warm sourcemap 条件，另有 `goods-card` 和 `kpi-board` 条件出现约 15.05% 和 7.38% 的 P95 回退，需要后续重复采样定位。native on 的 peak RSS 中位数相对 off 的最大增长为 1.05%，但 diagnostic 的 64 个 retained heap slope 仍全部为正，当前不能据此宣称内存持续改善。

本轮严格比较完整编译输出、sourcemap、`sourcesContent`、metadata、warning 顺序和错误结构，所有样本 parity 通过。profile 报告和 raw 证据保存在本地 ignored 目录，未纳入提交。结果支持继续保留 opt-in batch POC，不支持扩大默认启用范围，也不能外推为完整 CLI、HMR 或多平台构建的固定百分比收益。

### 内存和跨平台

现有 profile 同时记录进程 peak RSS，但 RSS 包含 import、配置准备和编译器依赖初始化，不能解释为 Rust 独占内存。正确性、release 构建和 fallback 已有多轮 Windows、macOS、Linux 验证。性能 profile 仍以单机或有限平台为主，跨平台性能结论需要新的统一采样。

## 收益解释

完整构建的可见收益受三个因素共同限制：

1. native 当前只替代部分 AST 分析，Babel 仍可能再次解析、遍历和生成。
2. JS 与 Rust 之间的字符串编码、序列化和结果校验会产生固定成本。输入较小或调用过细时，边界成本可能超过 Rust 计算节省。
3. 构建中还包含模板编译、模块图、文件系统、代码写盘、进程启动和 watcher 等工作，它们不会随 AST 分析自动缩短。

因此，局部分析的 20 倍级结果不能换算为整个项目的 20 倍构建速度。当前真实 SFC profile 更适合用低个位数至约 11% 的 P50 变化描述，P95 需要单独关注。

### 完整脚本转换的情景估算

2026-06-30 的阶段 profile 中，`transformScript` Babel 核心链路约占当时完整 `compileVueFile` 耗时的 19%。如果未来的 Rust 实现能把这整个阶段分别加速 2 倍或 3 倍，按 Amdahl 定律估算，完整 SFC 耗时约降低 9.5% 或 12.7%；即使该阶段耗时降为零，理论上限也约为 19%。降幅计算为 `0.19 × (1 - 1 / 局部加速倍数)`。

这只是基于 6 月代码和阶段占比的敏感性分析，不是当前 native 结果或承诺。当前 native 路径没有替换完整 `transformScript`，历史 2 倍或 3 倍场景也没有通过 Rust 端完整改写与代码生成的实测。未来即使达到这些 SFC 数字，完整 CLI 构建和 HMR 的收益还会受 bundler、文件系统及 watcher 时间稀释，目前没有可靠数据可给出其百分比预期。更现实的近期目标是先让批量分析收益在真实 SFC profile 中稳定出现，再评估完整脚本转换 POC；后者的收益上限可观，但兼容成本和回退面也最大。

## 后续路线

### 阶段一：扩大有效命中并减少重复工作

- 继续复用同一 SFC 内 script、script setup 和宏块的解析结果。
- 统计真实项目中 native batch 的命中率、拒绝项、fallback 原因和每次输入字节数。
- 将脚本摘要与模板 binding 分析的重复遍历合并到同一阶段，保持一次源码输入和一次 native 调用。

阶段一的目标是让现有 native 投入稳定覆盖热路径，收益预期仍以低个位数的完整构建改善为主。

### 阶段二：完整 `transformScript` Rust POC

一次 Rust 调用覆盖 parse、scope、改写和 generate，共用同一 AST。保留完整 JS fallback，并为不支持的语法整段回退。

该 POC 必须先解决以下兼容边界：

- Vue `script setup`、宏和 `defineOptions` 的语义。
- TypeScript 删除规则、JSX、注释和用户保留格式。
- 原始源码与模板投影之间的 offset 约定。
- warning、error、source map 和 `sourcesContent` 的精确一致性。
- native addon 加载、跨平台打包和失败后的单次 JS fallback。

这是当前最可能产生明显收益的 Rust 边界。收益上限应以 `transformScript` 在真实 SFC 中的独立占比为依据，不能用局部 AST microbenchmark 代替。

### 阶段三：模板编译和更上层构建路径

只有当 profile 证明模板编译仍是主要瓶颈，才评估模板 binding 分析或模板编译的 Rust 实现。模块图、写盘和 watcher 需要独立分析，不能因 Rust POC 成功就一并迁移。

## 建议的性能门禁

以下是后续 native 扩大范围前的建议门禁，当前不改变默认配置：

- correctness 必须逐样本比较代码、sourcemap、`sourcesContent`、metadata、warning 顺序和错误结构。
- `compileVueFile` profile 至少使用 40 对交替样本，覆盖 cold/warm 和 sourcemap 开关，并记录 addon load、peak RSS 与 fallback。
- 完整 CLI 构建和 HMR 单独采样，至少覆盖 Linux、macOS、Windows 中的实际支持版本。
- P50 需要在多数真实 fixture 上取得稳定改善，任何场景的 P95 回退都要单独复核并保留证据。
- 只有 native 命中率、parity、跨平台稳定性和完整构建收益同时满足门禁，才评估扩大默认启用范围。

## 证据索引

本报告引用的采样均来自仓库已保存的计划和验证记录：

- [2026-10-11 native profile](./2026-10-11-dependency-upgrade.md)
- [2026-10-15 真实 SFC profile](./2026-10-15-dependency-upgrade.md)
- [2026-10-26 发行入口 profile](./2026-10-26-dependency-upgrade.md)
- [2026-10-31 完整编译入口 profile](./2026-10-31-dependency-upgrade.md)
- [2026-11-10 最新 native profile](./2026-11-10-dependency-upgrade.md)
- [2026-11-11 native correctness 与跨平台验证](./2026-11-11-dependency-upgrade.md)
- [2026-06-30 阶段占比与 Amdahl 情景基线](../reports/2026-06-30-ast-native-migration-assessment.md)
- 历史 TDesign smoke：commit `0306700fd`，仅作为未通过门禁的反例保存。

本轮 profile 使用 release addon 和新鲜下游构建完成，报告状态为 `passed`。profile 工具的单测、ESLint 和独立 TypeScript 检查，以及 Rust、native addon 和 compiler 包测试均通过。诊断结果中的正 retained heap slope 与部分 P95 回退仍是未完成的性能门禁项，后续应在同一冻结输入上重复采样并补充更长的持续编译 session。

## 可复现入口

真实 SFC profile 的准备和采样说明见 [`scripts/astMigrationProfile/README.md`](../../scripts/astMigrationProfile/README.md)。核心命令如下：

```sh
pnpm install --frozen-lockfile
pnpm exec tsx scripts/astMigrationProfile/prepare.ts
pnpm exec tsx scripts/ast-migration-profile.ts
```

工具会重建 release addon 和相关发行产物，使用 40 对交替样本，严格校验输入身份和完整编译输出。profile 结果不能替代 package correctness、typecheck、CLI 构建、HMR 或真实 IDE 验收。
