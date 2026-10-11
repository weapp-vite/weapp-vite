# 合并 main 后的 Rust 批量分析交付与后续路线

**正式性能采样已完成，当前不扩大默认 Rust 覆盖。** 预定 Tailwind/TDesign 重复构建 P50 仅减少 1.21%，未达到 10%；路由拓扑首次编辑 P95 首批增加 16.98%，等量确认仍增加 13.05%。真实零售页暖编译 P50 减少 15.29%，但小脚本存在明显回退。现有证据支持继续研究局部计算内核，不支持承诺全项目 Rust 化带来普遍大幅提速。

完整表格、测量边界和公开数值见 [生产链路报告](../reports/2026-10-11-rust-batch-production/README.md)。本文件记录最终实现、历史范围与下一步决策，不把旧计划中的未执行项标为完成。

## 合并与采样身份

本轮以 merge 保留历史，将 main `9b69ec88` 合入 `codex/rust-batch-profile`，合并提交为 `1bbee9f45`。解决 native 依赖与快照测试冲突，采用 main 的 Oxc 0.153、napi 3.14 基线，保留 `script_transform`、`template_provenance` 和实验 feature，同时保留主线 HMR/watch/native publication 修复。

正式构建/HMR 采样冻结在 `ec7286064610a42579e1a444dee65fa0c33d146d`，源码、addon、相关 dist、driver 与输入身份见 [数值证据](../reports/2026-10-11-rust-batch-production/native-paired.json)。合并身份仅说明本轮基线，不表示之后 main 不再变化。

采样完成后修复了摘要稀疏数组校验和 CI 测试/准备契约；这些是 correctness 修复，未重新采样，不将冻结版本数字改称最终提交性能。正式采样已经结束，最终 PR head 的必需 CI 尚未全部完成。

## 已实施的粗粒度边界

`analyzeCompilerScriptsNative(inputs[])` 一次跨 N-API 传入同一 SFC 的相关脚本块，原始宏源码与预处理脚本合并提交；native 对相同 `(code, filename)` 复用解析，不同分析配置保留各自结果。返回 imports、default export、页面 feature flags、静态 require、平台 API、宏名称/语句范围及适用的静态组件注册等紧凑摘要，不返回完整 AST、不逐节点回调 JS。

生产编译器共享摘要给 `componentSources`、原始 `defineOptions` hash 和 `compileScriptPhase` 等入口。原始语句范围使用 UTF-16 偏移，保留现有源码 hash 与 Babel 生成语义。直接静态 Options API 注册可消费 native tag/local 映射；动态对象、spread、computed、getter/method、复杂 wrapper 或无法证明安全的注册继续交给原分析路径。

resolver、缓存、文件 I/O、最终 Babel AST 和 generate/source map 仍由 JS 编译器承担。native 加载、执行、解析、字符串无损表示或结果校验失败时按项回退；有效邻项继续使用摘要，每个失败项只记录一次 fallback，不把失败包装成空成功。采样后校验补充逐索引检查，拒绝稀疏 imports、registeredComponents、featureFlags，回归保留单次 batch、单项 fallback 与邻项有效性。

native 仍是可选依赖，仅在 `WEAPP_VITE_NATIVE=1` 且配置有效 `WEAPP_VITE_NATIVE_AST_PATH` 时启用。没有改变默认用户配置，未把 Node addon 移植到小程序宿主，未替换 runtime、CLI、IDE/MCP 编排。

## 正式验证结果

| 观察面 | 完成情况 | 结果 |
| --- | --- | --- |
| 完整构建/HMR | 560 个首批侧运行 + 160 个确认侧运行，共 720；每组 40 对 | 100 个 wall/RSS 指标完整，无运行错误/缺样；性能 gate 为 regression |
| 预定目标：Tailwind/TDesign 重复构建 | P50 1683.990 → 1663.582 ms | -1.21%，未达到 -10% |
| 路由拓扑首次编辑 P95 | 首批 +16.98%，确认 +13.05% | 确认超过 5% 回退线 |
| 其它触发确认项 | 原生样式两项、组件拓扑一项、路由拓扑恢复一项 | 共 4 项 unstable，保留两批，不挑选较快结果 |
| 真实 compileVueFile 暖入口 | 10 案例，每侧每例 40 次，两次预热，身份一致 | 零售页 P50 -15.29%；Wevu 首页 +1.21%；双 script +16.35%、P95 +388.92%；无 default export +13.96% |
| 生产摘要正确性 | 完整返回值、map、告警、预期错误与单次故障回退对照 | 适用案例对齐；暖入口全量比较不等同于全项目/runtime parity |
| 旧完整 Rust script transform | 8 个完整脚本执行 worker、4 对受控语义场景 | semanticComparisonPassed=true；compilerComparisonPassed=false，联合 parity 仍失败 |
| 最终跨平台 CI / 宿主验收 | 最终 CI 待完成；本轮性能报告未跑 headless、Stable IDE 或真机 | 不宣称跨平台/真实宿主验收已通过 |

完整构建覆盖原生、Wevu、Tailwind/TDesign；HMR 包括各自脚本/模板/样式，以及额外组件/路由拓扑。首次构建清空输出并新起 CLI，重复构建保留输出但也新起 CLI；均未清空 OS 缓存。HMR 使用 120 ms polling watcher，编辑与恢复的首轮/重复轮分别记录。配对差值中位数与分位数比值同时保留，避免将统计量方向不一致掩盖成收益。

计划中的全面归因尚未完成：正式构建/HMR 只采 wall/RSS；native-on 构建 CPU/主 isolate GC 是额外单侧诊断，不是 40 对 CPU/GC 对照，也没有完整内部 parse/traverse/generate 或 HMR 跨界次数。暖入口另有独立 off/on CPU/GC 与 Babel wrapper 计数，但不是全部 Vue/Oxc/Rust 内部解析次数。wall 减 CPU 不等于等待。

RSS 区分编译后 worker 快照、构建进程树离散峰值与 HMR 强制 GC 后快照。构建有 20 个 partial RSS 观测，保留有效/不可用采样次数；快照和离散峰值不能证明真实峰值更低。测试发生于共享负载机器，off/on 包含全部适用 native 路径，没有仅新增 batch 的消融，不把观察到的差异直接归因于单项实现。

## 正确性与旧实验的边界

完整 Rust script transform 仍通过独立 feature 与诊断 adapter 运行。main 新增的 `nativeSlotContext` 按 contract marker 追加，保持已有属性后写覆盖、skipComponentTransform 和未映射生成代码的规则；未知 option、缺失 contract 和未支持语义继续 fail closed。受控 Node worker 使用完整编译脚本和真实响应式/模板 helper，但不等于真实小程序宿主。

完整 transform 的 sourcemap 等严格编译差异仍未通过。`completed=true` 只说明执行结束，`semanticComparisonPassed=true` 只证明已覆盖 probe，二者不能代替整体 `comparisonPassed=false`。因此继续以 Babel AST/generate 作为默认语义基线。

PR #1175 保留此前批量分析、实际链路 profiler、构建/HMR 对照、chunk 分析、binding summary/arena、JS 脚本优化、Rust 阶段转换、printer/sourcemap 和语义探针的历史。已撤回的 WXML native 扫描接入不能重新计为生产迁移；保留的 JS 重复工作消除按实际交付边界说明。历史 7 对构建、20 对 HMR 和 micro benchmark 不替代本轮 40 对正式证据。

## 维护、发布与验收

新增职责已拆入 `compileVueFile/nativeAnalysis.ts`、`nativeComponents.ts`、Rust `compiler_analysis/` 和 AST `native/compilerAnalysis.ts`；新对照工具按 fixture、worker、收集、错误证据、身份和启动职责拆分。对超过 300 行的既有 `lib.rs`、编译阶段主体与长组件收集文件，保留原阶段顺序而不做全量重排，避免扩大 Babel/Oxc fallback、sourcemap 和合并审查风险；后续职责重构单独推进。

默认关闭的新实验不新增 changeset；历史行为变化已有 changeset 保留，三份旧摘要仅补充当前 main 要求的 Conventional 前缀。公开报告使用相对证据链接，保留数值、失败和来源摘要；原始源码、错误栈、机器路径和日志不公开。

采样后的本地验证已完成 AST 28 项单测、typecheck/ESLint，AST → @wevu/compiler → weapp-vite 顺序重建、AST 类型契约、准备闭包 3 项及串行 opened-automator 8 项 mock 测试（未启动 IDE）。[最终生产入口 correctness 检查](../reports/2026-10-11-rust-batch-production/compiler-final-check.json)完成 10 个案例与单次故障回退，计时配对数为 0；它使用修复后的源码/dist 身份，即使元数据 commit 仍为冻结 SHA，也不能视为该冻结性能版本的复测。最终 PR head 全部必需 CI 仍待完成。

已知 CI 准备失败修复为保留真实导出的 partial mock、补全 driver 的 devtools-runtime 构建闭包和接受合法零 CPU 观测；Ubuntu Node 26 Web HMR restore 超时增加定向证据，不通过提高超时或削弱断言求绿。

## 后续决策

1. 保持 native 显式启用，先定位路由拓扑 P95 回退以及小脚本跨界固定成本；对构建、watcher、宿主等待分别归因，不先扩大迁移面积。
2. 对新 batch 做独立消融，固定输入、源码与实际产物，验证哪些完整计算阶段占据 CPU 热点；优先减少重复工作和无效重建。
3. 优化后按相同三类工程和拓扑、40 对交替、既定 10%/5% 门槛重新采样，保留未通过轮次。只有目标达标、其它场景无稳定回退、产物/告警/map/fallback/runtime 语义及跨平台验证全部通过，才考虑扩大默认覆盖。
4. WXML/SFC 完整阶段和 mpcore 纯计算内核仍须各自证明收益与语义；runtime、CLI、IDE/MCP 保持 JS，完整 Rust transform 不提前替代 Babel。
