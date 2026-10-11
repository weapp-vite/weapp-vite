# 构建启动与重复分析优化：后续证据

本轮在合并 `main` 的批量 Rust 分析实验上继续优化生产链路。代码提交为 `e31b9e743`。**尚未证明全项目显著提速，native 继续默认关闭。** 前一轮正式性能验收失败的 [原始证据](../2026-10-11-rust-batch-production/README.md) 保持不变。

## 本轮改动

- CLI 注册命令时保留同步参数与帮助解析，执行阶段延迟加载构建、IDE、MCP、分析、上传等依赖；serve 启动仍在受控取消与清理范围内。
- 同一构建代际复用独立分包准备结果。配置输入在异步工作之前捕获，嵌套修改、替换或失败均回退；不跨代复用。
- 模板表达式仅在无需作用域信息的转换中关闭 Babel scope 分析；WXML 只缓存最终字符串，限制为 1024 项及 1 MiB，不共享可变 AST。
- Rust 批量摘要复用既有遍历生成保留 props 诊断，同源输入复用完整分析结果。缺失诊断字段只回退该项检查，其他摘要继续有效。

默认可见的 CLI、HMR 和表达式改动包含 changeset；默认关闭的 native 实验没有单独新增 changeset。

## 真实编译入口：40 对 native off/on

每对两侧各启动新进程，固定 10 个案例及顺序，每个案例先完整预热两次。计时覆盖生产 `compileVueFile` 调用；比较完整返回值、map、告警和支持的错误字段。所有配对及预热的语义对照通过，输入和源码身份未变。此处是暖编译入口诊断，不能替代完整构建或 HMR 验收。

| 案例 | off P50（ms） | on P50（ms） | P50 变化 | P95 变化 |
| --- | ---: | ---: | ---: | ---: |
| Wevu 首页 | 16.524 | 15.301 | -7.40% | -10.98% |
| 零售详情 | 30.985 | 28.321 | -8.60% | -11.28% |
| defineOptions | 1.035 | 0.963 | -6.96% | +1.18% |
| 双 script | 0.719 | 0.755 | +5.05% | +21.96% |
| 无 default export | 0.199 | 0.219 | +10.12% | +16.65% |
| 导入组件 | 0.837 | 0.807 | -3.61% | -20.86% |
| Options API 组件 | 0.398 | 0.292 | -26.77% | -17.47% |
| 转义字符串组件 | 0.652 | 0.695 | +6.60% | +15.69% |
| 模板错误 | 0.189 | 0.213 | +12.89% | +14.97% |
| 脚本错误 | 0.080 | 0.094 | +17.10% | +24.40% |

独立诊断中，Wevu 的 Babel wrapper parse/traverse 从 66/155 降至 65/153，零售详情从 157/374 降至 155/371。两页各调用一次 batch，均无 fallback。转义字符串、无效脚本及注入故障保留预期的单次 fallback。wrapper 计数不包含 Vue/Oxc/Rust 内部操作。调用后 RSS 快照下降约 3.2–4.6%，不是进程树峰值内存结论。

原始配对、摘要和诊断见 [compiler-native.json](./compiler-native.json)。采样时源码尚未提交，报告以采样前后文件哈希为准，不把报告中的旧 HEAD 当成当前候选身份。

## JS 优化与完整链路冒烟

单独关闭两侧 native 的表达式优化对照共 40 对：零售详情暖编译 P50 降低 6.29%，Wevu 首页降低 0.66%。部分微小案例的 P95 增加，完整数据见 [expression-native-off.json](./expression-native-off.json)。这些是 JS 路径收益，不能归为 Rust 提速。

当前产物 native off/on 的完整链路冒烟覆盖三类工程的首次/重复构建，以及脚本、模板、样式、组件拓扑和路由拓扑 HMR，共 28 次侧运行、200 个样本。输入、产物、map 和告警一致，无运行错误。独立构建诊断中，原生模板没有 native 调用，Wevu 两次构建共 10 次，TDesign 共 2 次，均无失败。两对冒烟不作性能门禁结论。可用已有纯评估入口重放 [native-smoke.json](./native-smoke.json)：

```sh
pnpm exec tsx docs/reports/2026-10-11-build-startup-followup/replay.mts
pnpm exec tsx docs/reports/2026-10-11-rust-batch-production/replay.mts docs/reports/2026-10-11-build-startup-followup/native-smoke.json
```

CPU profile 原驱动误设 `WEAPP_VITE_NATIVE_PATH`，实际 loader 使用 `WEAPP_VITE_NATIVE_AST_PATH`，且父环境两者均未设置。因此那六份构建 profile 只作为 native 关闭的 CPU 诊断；不能用于 native-on 归因。原驱动和原 profile 保留，修正见 [cpu-attribution-correction.json](./cpu-attribution-correction.json)。

## 验证与边界

- compiler：110 文件、1240 测试；CLI：16 文件、268 测试；HMR：5 文件、128 测试，通过。
- 实际 addon：59 测试通过，含 26 个新诊断对齐案例；Rust compiler analysis 10 测试通过。
- AST、compiler、weapp-vite 的包级 typecheck 及适用类型契约通过；按依赖顺序重建 AST/native、compiler、weapp-vite 后执行下游冒烟。
- Web 入口 12 文件、119 测试通过。覆盖率为 93.5% statements、91.13% branches、98.26% functions、93.28% lines；这不是 100% coverage 门禁通过记录。
- 限定 ESLint、改动 Rust 文件的 rustfmt、提交 hooks 通过。完整 crate 的历史格式问题不记为本轮 rustfmt 通过。
- 本轮真实 DevTools 与真机 runtime 未执行；完整 Rust script transform 的严格产物/map parity 尚未通过，继续隔离实验。

超过 300 行的文件已评估：build 命令拆为 action、registration、completion；analyze/IDE action 保留既有控制流，只移动加载边界，避免同步改写生命周期。options 的交接逻辑拆入专门模块；WXML normalizer 保留一个内聚实现及有界字符串缓存。

跨版本隔离冒烟另完成 28 次侧运行，100 项 wall/RSS 指标的原始证据完整，产物、告警、逐轮保留的 sourcemap 均一致。map 仅规范明确归属的源码根目录，不改变 mappings、names、sourcesContent 或未知来源。

计时外真实拓扑诊断覆盖两侧各 8 次 fullEntryScan：基线每轮独立分包构建 2 次；候选全部降为 1 次，且 buildStart 阶段不再扫描或重复构建。配置守卫实际被接受，交接 8/8 次命中。见 [hmr-handoff.json](./hmr-handoff.json)；带诊断包装的 wall/RSS 不作性能数据。

完整构建/HMR 的旧版对新版 40 对验收现已完成，见[默认架构性能报告](../2026-10-12-build-architecture-performance/README.md)。TDesign 重复构建 P50 降低 10.27%，但两项 HMR 指标在确认批仍稳定回退，整体门禁为 `regression`。两侧 native 均关闭，不能把架构组合收益记为 Rust 的边际收益。

## CLI 模块编译缓存后续实验（10 月 12 日）

CLI 在 engines 检查后、加载执行入口前启用 Node 模块编译缓存。保留 Node 的目录和禁用变量语义，覆盖率及 Vitest 环境不主动启用；目录不可用时仍正常执行。实际子进程测试覆盖同路径源码变更、默认/显式目录、禁用、目录失败和冷暖缓存的 sourcemap 错误位置。

同一冻结新版、native 关闭的 4 对交替诊断中，重复构建 P50 从 1474.775 ms 降至 1384.140 ms（-6.15%）；首次构建从 1894.656 ms 增至 2021.631 ms（+6.70%）。两侧每对使用独立缓存目录，同侧 prepare、首次和重复构建共享目录。实际三个 CLI 子进程逐个确认缓存开关，产物/map/告警一致，冻结产物和依赖在采样前后核验一致。此处仅验证缓存收益与首次生成成本，不能视为完整候选通过，不能归因于 Rust。见 [cli-cache-diagnostic.json](./cli-cache-diagnostic.json)。此前两个未正确启用缓存或未进入采样的尝试保留在私有诊断记录中，没有纳入统计。

缓存相关的两个测试文件共 20 项通过，weapp-vite typecheck、构建、限定 ESLint 和 website 构建通过；website 的 SEO 检查为 0 问题。正式旧版/新版比较将使用 CLI 自身的默认行为，不用环境变量提前替两侧启用缓存；每个配对侧从独立的空临时目录开始，明确区分 prepare 后首次构建与重复构建。
新增缓存候选的第一次跨版本冒烟完成 28 次运行、100 对产物/map/告警/输入对照，但收尾身份核验拒绝新增的 Rolldown 临时目录与 Vite 预构建目录。该轮保留为测量基础设施失败，不作通过记录或性能结论；归档只处理本轮明确新增的目录。后续协议将 npm、Node、Rolldown 和 Vite 各类缓存按配对侧隔离，同侧首次/重复构建保留自然复用，再在侧运行结束时归档。较早隔离冒烟未完整记录这些生成目录的生命周期，也不作为正式性能验收。
