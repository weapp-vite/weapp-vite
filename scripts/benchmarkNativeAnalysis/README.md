# Native analysis 端到端配对基准

此工具比较同一源码、同一 dist 和同一依赖树中的 `WEAPP_VITE_NATIVE=0/1`。先重建受影响包及 native release binding，再由一个负责人串行执行；不得与其他 E2E、watch 或性能采样并发。

该 off/on 对照包含此前已存在的 native 分析加速，不能把观测收益全部归因于本次新增的滚动诊断复用。

```sh
pnpm benchmark:native-analysis --mode=smoke --native-path=packages/ast-native/index.js --output=.tmp/native-analysis-smoke
pnpm benchmark:native-analysis --mode=full --native-path=packages/ast-native/index.js --output=.tmp/native-analysis-full
```

输出目录必须不存在。`--repo` 可指定已准备的 checkout。默认 `--runtime=classic`；也支持独立运行 `--runtime=stateful-experimental`，两个模式不能混样。工具不会安装依赖、重建包或操作真实 IDE。

- `smoke` 默认 2 对，可用 `--smoke-pairs` 增加，但不允许少于 2。只验证采集完整性、native 命中及产物等价，不作正式性能通过结论。
- smoke 的独立 `metrics` 摘要按配对证据显示 `diagnostic-only` 或 `incomplete`，`regression` 为 `null`；耗时或 RSS 波动超过正式阈值不会触发性能回退或确认批次判定。
- `full` 只接受干净已提交 checkout，固定每模板 7 对构建、每 HMR 场景 20 对；不提供降低轮数或改变阈值的选项。
- 每对交替 off→on/on→off。两侧复用同一路径、固定 marker 和输入摘要，每个 build/HMR 采集子进程均受 15 分钟 deadline 约束。
- 首次构建使用新 CLI 进程与清空的工程输出，重复构建再次使用新 CLI 进程并保留输出；不声称清空 OS 缓存或测量进程内暖编译。
- 三类真实模板覆盖构建、脚本、模板与样式。拓扑使用仓库已有 `issue-1134-profile` 的 route/component 编辑及恢复，明确作为独立 fixture，避免改变 Wevu 自动路由模板的输入语义。
- 目标预先固定为 Tailwind/TDesign 的重复构建 wall P50 至少降低 10%。全部场景 wall/RSS 的 P50/P95 检查 5% 回退；越线最多一次等量确认，两批冲突为 unstable，不能反复采样求绿。目标未达成以非零退出保存合法 POC 结果。
- native binding 缺失、错误探针结果、目标工程无实际命中、诊断加载/执行失败或 fallback、缺样本、产物不等价、内存缺失或清理失败均不可通过。独立诊断 preload 在两个真实构建子进程入口订阅现有 native channel，必须完整观察到各自退出；其他代表工程确无适用工作时标为 `not-exercised` 对照，不能视为 native 覆盖。固定 TDesign 目标必须命中。调用计数包装器、preload 和写日志不进入正式计时；诊断产物须与正式 on 样本等价。
- 完整比较最终文件集合、JS/WXML/样式/JSON 与外置 sourcemap，只规范工作目录与 JSON 键序；不删除随机 helper、HMR 协议字段或有意义内容。动态 stateful 元数据若不同，保留不可比较结果，不自动放宽规则。
- 警告比较保留 CLI 输出中的警告段落；其作用不替代 compiler 结构化诊断回归。

`report.json` 保留逐轮原始数据、输入和产物摘要、真实绑定摘要、一次确认清单及重新计算的门禁。采集错误后保存已完成样本并停止后续批次，避免在清理状态不确定时继续计时。构建 RSS 是离散采样到的进程树峰值，HMR RSS 是 GC 后快照，不能混为相同指标。

HMR 沿用现有测试协议的 120ms polling watcher；每次计时结束后强制 GC 并读取完整产物。这些步骤会影响下一次编辑的状态，因此结果只代表相同观测协议下的编辑到产物可见延迟，不能直接外推日常默认 watcher 的延迟。

RSS 探针同时记录成功/不可用次数和完整性状态；至少需要一个真实有效样本。末次进程树采样可能与子进程退出竞争，因此 partial 保留为公开限制，不等同于完全缺失，也不宣称采到了瞬时真实峰值。HMR 固定关闭 compiler profile JSONL，保留两侧相同的 inspector/GC/产物观测；编译器归因另行诊断。报告附 OS release、CPU 型号/数量、总内存、起止时间与 loadavg，不记录用户名或 hostname。

本工具始终标记 headless runtime、Stable IDE、真机与其他 OS 为 `not-run`。单机 smoke、构建成功或采样进程退出 0 均不能替代这些验收。

纯功能验证：`pnpm exec vitest run --config scripts/vitest.config.mjs scripts/benchmarkNativeAnalysis`。这只检查驱动合同，不启动 build/watch/E2E，也不代表性能结果。

## 隔离目录与平台诊断

`checkStage.ts` 在新的输出目录里运行第一个真实代表模板的 prepare 和两次诊断构建，检查产物/maps 及 native 观察完整性，不启动 HMR、不执行性能门禁：

```sh
node --import tsx scripts/benchmarkNativeAnalysis/checkStage.ts --output=.codex-tmp/native-stage-check
```

它复用正式采集器的 staging 和 build worker，因此可在三平台 CI 中较早暴露依赖链接、目录写入或启动错误。原生模板无适用 native 工作时记录 `not-exercised`，不冒充目标 TDesign 的覆盖。

诊断构建在 prepare 前保存 `dependency-layout.json`，分别读取原依赖目录、暂存工程和仓库的 `node_modules/weapp-vite` 直接路径，记录 lstat/stat/readlink/realpath 及直接 package.json 的结果。路径脱敏，读取错误只记录错误码；诊断读取失败仍继续真实构建。不能用可沿父目录回退的 `require.resolve` 成功来替代这些直接路径证据。worker 的具体构建错误优先保留，避免被外层 collector 的通用退出信息覆盖。

这些读操作仅用于诊断，不进入正式配对计时。平台失败仍须结合原始构建日志和对应操作系统结果判定根因，增加诊断不等于修复通过。
