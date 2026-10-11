# 2026-10-12：Node 编译缓存改为显式启用后的构建诊断

CLI 撤回默认自动启用 Node 模块编译缓存，保留 Node 启动时 `NODE_COMPILE_CACHE` 指定目录、源码失效和禁用环境变量的原生语义。本候选的三类工程各完成四对首次／重复构建，输入、产物、sourcemap 和告警零差异。

相对早期 PR 基线，原生与 Wevu 构建 P50 降低约 15%–18%；TDesign 重复构建降低 **7.43%**，仍未达到固定的 10% 目标。TDesign 首次构建 RSS P50 为 **−1.15%**，重复构建为 **+4.91%**。样本少且后者接近回退门槛，不能宣称内存风险已消除。评估器状态是 `smoke-valid`，正式验收 `not-run`。

## 选择依据

- 既有[缓存开关诊断](../2026-10-11-build-startup-followup/README.md)中，同冻结候选四对 cache off/on 显示：TDesign first wall +6.70%、RSS +5.20%，repeat wall −6.15%、RSS −4.26%。自动开启缓存存在首次与重复构建的明确权衡。
- 已做的[提前 flush 实验](../2026-10-12-compile-cache-flush-diagnostic/README.md)未解决问题：TDesign first RSS 仅降低 0.14%，没有再次尝试相同方案。
- 精确 Node v22.22.3 与本机 v24.18.0 的 `CompileCacheHandler::Persist()` 都会清空 entry store，释放其持有的序列化缓存 buffer；handler 仍开启，后续模块可重新填充。flush 不会卸载模块或执行代码，也不保证 allocator 将 RSS 交回系统。不能把再次 flush 当作新的归因假设。
- 这轮保留用户显式启用能力，取消框架自动启用；不设置新的禁用变量、不创建项目配置、不改变已有用户环境。Node 在 CLI bootstrap 执行前已处理非空 `NODE_COMPILE_CACHE`。

官方实现参考：[Node 22 compile_cache.cc](https://github.com/nodejs/node/blob/v22.22.3/src/compile_cache.cc)、[Node 24 compile_cache.cc](https://github.com/nodejs/node/blob/v24.18.0/src/compile_cache.cc)、[Node 22 env.cc](https://github.com/nodejs/node/blob/v22.22.3/src/env.cc)、[Node 24 env.cc](https://github.com/nodejs/node/blob/v24.18.0/src/env.cc)。源码分析不代替构建验证。

## 对照范围

- 基线仍为 PR 早期 `419f49d91` 的三个相关包，不是 main。候选是当前默认 JS 优化组合，包含缓存撤回和最新 native 摘要源码；**两侧 native 均关闭**。结果不能归为 Rust 收益，也不是上一版候选与撤回缓存之间的隔离对照。
- 沿用 v4 的不可变外部依赖，提前冻结产物。与 v11 相比共同测量树仅新增一项 CI 测试文件内容变化，实际 collector/evaluator 无改动；该文件不参与测量。基线产物保持原字节。
- 每工程四对 AB/BA，24 次侧运行、48 个构建样本、12 项 wall/RSS 指标。每侧先 prepare，再测 first/repeat；临时目录和 npm/Rolldown/Vite 缓存按侧隔离，同侧两次构建自然复用，结束归档，不跨对复用。
- Node v24.18.0、macOS arm64。全程取得机器串行 lease 并保持唤醒；无其他本任务构建或 watcher 并行。所有 worker 和 lease 已释放。
- 所有 24 次 prepare 成功。首尾冻结身份校验通过，发布证据时 1,274 个生产源码/bin/dist/package 文件与当前 checkout 一致。

## 四对构建结果

负值表示候选更低。RSS 为进程树离散采样所得观测峰值，不是连续真实峰值。只有四个值的 P95 容易受单个样本影响，不能据此判断稳定通过。

| 工程／阶段 | wall P50 ms：基线 → 候选 | wall P50 | wall P95 | RSS P50 bytes：基线 → 候选 | RSS P50 | RSS P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 原生 first | 744.754 → 608.575 | -18.29% | -46.52% | 352,960,512 → 298,205,184 | -15.51% | -15.06% |
| 原生 repeat | 737.531 → 606.328 | -17.79% | -20.06% | 347,602,944 → 295,641,088 | -14.95% | -15.53% |
| Wevu first | 800.783 → 681.765 | -14.86% | -15.39% | 398,016,512 → 355,344,384 | -10.72% | -10.99% |
| Wevu repeat | 801.297 → 677.087 | -15.50% | -17.04% | 393,715,712 → 355,172,352 | -9.79% | -10.15% |
| TDesign first | 1989.371 → 1860.713 | -6.47% | -14.97% | 810,213,376 → 800,923,648 | -1.15% | -1.25% |
| TDesign repeat | 1559.230 → 1443.381 | -7.43% | -8.72% | 656,900,096 → 689,184,768 | +4.91% | +0.53% |

48 个样本中有两个 TDesign baseline repeat 的 RSS 标记为 `partial`，各含 13 次成功和 1 次不可用采样；全部保留，未删除或重采。其余 46 个为 `available`。统计数据结构沿用 `MedianMs` / `P95Ms` 字段名，RSS 值实际单位为 bytes。

全部逐对数据、输入/产物摘要、map parity 和汇总见 [evaluation.json](./evaluation.json)，准备日志见 [preparation-logs.json](./preparation-logs.json)。[provenance.json](./provenance.json)记录私有原报告、身份及评估文件哈希；公开数字未改写，仅规范化本机路径。报告未发布原始 emitted JS、完整冻结依赖和缓存目录，不能视为独立重放包。

## 验证及决策

- 两个 CLI 测试文件共 27 项通过：默认不创建缓存，显式绝对/相对目录，冷暖缓存，禁用变量存在性，源码变更，coverage/Vitest 调用方选择，source-map 错误位置，prepare fallback 及 engines。
- `pnpm --filter weapp-vite typecheck`、限定 ESLint、`pnpm --filter weapp-vite build` 通过；重建后才执行本轮下游构建。无公开 TypeScript 类型变更。
- README、随包文档、website CLI 页同步显式缓存说明；`pnpm --filter website-weapp-vite build` 通过，SEO 305 页检查为零问题。生成资产通过构建刷新，未手改。
- 复用本 PR 的用户可见行为 changeset，继续联动 `create-weapp-vite`；默认关闭 native 不单独新增 changeset。修改文件均小于 300 行。

本候选保留默认自动缓存撤回。目标 TDesign 重复构建仍只有 −7.43%，尚不值得启动新的完整 40 对构建/HMR 门禁。下一步需定位其剩余真实开销；此前稳定 HMR 回退和未完成的真实宿主验收仍有效。本轮没有重测 HMR，不能将构建冒烟成功写成全项目或 HMR 性能通过。
