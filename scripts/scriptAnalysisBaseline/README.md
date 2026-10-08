# 脚本分析的 JS 基线实验

此工具用诊断加载器验证四项 JS 优化的语义边界，为后续 Rust 完整阶段实验提供更强的对照。它不修改生产源码，不启用 native，也不采集耗时。

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/scriptAnalysisBaseline
pnpm exec tsc -p scripts/scriptAnalysisBaseline/tsconfig.json
node --import tsx scripts/scriptAnalysisBaseline/check.ts --output=.codex-tmp/script-baseline-check
```

输出目录必须不存在。七个独立进程按顺序运行原始编译器、相同 loader 控制组、四项单独优化及组合版本。每个场景调用两次，均对照原始编译器的首次完整返回值、sourcemap、告警和错误，防止已改写 AST 在后续调用中被错误复用。错误对照包含 name/message 及公开诊断的 code/severity/filename/source/loc，不比较 stack 或任意 cause。

| 实验 | 约束 |
| --- | --- |
| AST 所有权移交 | 仅同次编译、最终源码逐字相同且 fast path 未命中时消费一次；不强制触发懒解析，异常和未消费 token 均释放 |
| props visitor 不构建 scope | 只对不查询 binding 的 return-info visitor 启用 `noScope` |
| page-meta 负向检查 | 使用现有 `mayContainPageMeta`；可能包含宏或转义时保留原分析 |
| reserved-props 负向检查 | 无告警回调、无源码，或既无 `defineProps` 又无反斜杠时跳过；正向语义不变 |

32 个场景包含真实页面、压力模板、嵌套循环、slot、JSX、TSX 源码变化、宏别名/转义/遮蔽、reserved-props 类型及运行时声明、Unicode/CRLF 和错误清理。报告要求所有预期分支实际命中，结束时无活动编译或待消费 token。

`report.json` 保存编译器和诊断源码 hash、场景源码及完整输入 hash、每次输出 hash 与计数。每个 worker 回传实际输入摘要，与父进程预读的场景逐项比对，防止真实页面语料在进程间变化。完整输出保存在各 worker JSON；CI 只上传摘要和去除仓库路径的日志。采集前后核对源码身份，依赖身份由 lockfile 记录，未逐文件重算已安装依赖。

此结果只证明所列场景的转换一致性。性能、完整 Vite/HMR、RSS、小程序运行时和生产接入仍需各自验证。源加载替换锚点必须唯一，编译器结构变化时工具应失败，不能静默跳过实验。

## 完整编译计时

```sh
node --import tsx scripts/scriptAnalysisBaseline/timings.ts --output=.codex-tmp/script-baseline-timings --iterations=42
```

采集器先执行上述 32 场景七路正确性对照，再串行执行压力模板、零售详情、Wevu 首页各两批。每组重新创建七个持久 worker，先校验输出，按 14 轮平衡周期预热，再采样 42 轮。每个 worker 的同次编译生命周期和四项计数照常发生；全部 reset、输入 hash、IPC、输出序列化和对照在计时外。正确性和计时共用执行逻辑，保留所有告警和公开错误诊断字段。

每组测量都对照首次原始输出，输入/输出摘要还要与采样前的完整正确性 oracle 相同。校验器拒绝缺轮、顺序变化、未清理 token、源码或语料漂移、非法计时/RSS、不同 loader 源码及重叠批次。输出已有目录时拒绝覆盖，失败批次不自动重试。进程传输复用 binding 实验的所有权管理；controller 异常断开 IPC 时 worker 完成当前操作后清理并退出。

`summary.json` 保留每组原始观测，以及 baseline→control、control→各单项/组合的逐对耗时差值和 P50/P95；语料和批次不混池。RSS 是编译后 worker 快照，CPU 来自进程 CPU 用量；均不能解释为峰值内存或 V8 主线程采样。计时包含诊断 hook 本身的成本，仍是温热编译实验，不是生产补丁验收，也没有测量 Rust 收益。

Native AST Analysis 的 `script-baseline-performance` 手动输入启用三平台采集，使用独立 concurrency group。采样 artifact 包含原始分组报告、正确性完整输出、去仓库路径日志和发生分歧时的完整输出对照。共享 runner 的争用没有独立测量；不同平台的绝对时间不可直接比较。
