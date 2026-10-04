# 优化 JS 基线上的 Rust 组合诊断

本工具把已有脚本 JS 优化与模板 manifest 批量分析组合，验证完整编译的语义并定位剩余热点。所有 hook 只存在于独占诊断进程，生产编译器和默认 native 开关不变。

| 实现 | 脚本处理 | 模板 binding 分析 |
| --- | --- | --- |
| `baseline` | 原始编译器 | 原始编译器 |
| `control` | 相同 loader，原始逻辑 | 相同 loader，原始逻辑 |
| `optimized-js` | AST 所有权复用、props noScope、保守宏检查 | 原始逻辑 |
| `optimized-summary` | 同上 | JS 批量计划及语法摘要缓存 |
| `optimized-native` | 同上 | 相同计划上的 Rust 批量分析 |

绑定 loader 必须先于脚本 loader 安装。每次编译重置两套诊断状态，检查没有未消费输入、活动模板或 AST 移交残留，结束逆序卸载。native 仅从显式指定的 `.node` 加载。

## 复现

先构建工作区依赖及已有实验绑定，以下步骤依次执行：

```sh
pnpm exec turbo run build --filter=weapp-vite...
pnpm --filter @weapp-vite/ast-native exec napi build --platform --release --features experimental-binding-analysis --no-js --dts target/binding-experiment.d.ts --output-dir ../../.codex-tmp/binding-native-release
node --import tsx scripts/optimizedCompilerAnalysis/check.ts --binding-dir=.codex-tmp/binding-native-release --output=.codex-tmp/optimized-compiler-correctness
```

也可使用 `--binding=<实验 .node 文件>`。目录形式必须恰好包含一个 `.node`；每次使用新的输出目录。子进程强制 `WEAPP_VITE_NATIVE=0` 并清空 `NODE_OPTIONS`，避免生产 native 或外部 preload 混入对照。

正确性矩阵保留已有 32 个脚本场景和 13 个 binding 场景的原始选项。五实现各调用两次，共 450 次。所有完整返回值、sourcemap、告警和公开错误都与原始编译器逐字比较，同时要求正向/负向脚本分支、批量分析、独立 slot 消费、JSX 同步分析及两个故障回退确实发生。完整输出存在各 worker 的私有 `report.json`；顶层报告只保存 hash 和指标。

## 主线程归因

```sh
node --import tsx scripts/optimizedCompilerAnalysis/profile.ts --binding-dir=.codex-tmp/binding-native-release --output=.codex-tmp/optimized-compiler-cpu
```

此命令先自动重做 450 次正确性校验，再串行运行压力模板、零售详情和 Wevu 首页的五路独立进程。每组一次初始编译、14 次预热、20 次独立 Inspector 采样，共 525 次完整输出校验与 300 份原始 profile。

只有 `compileVueFile` 回调放进每次 start/stop 窗口。哈希、指标快照、输出序列化/比较和落盘在窗口外；调用间的报告工作仍可能影响后续 GC/调度。每份原始图写盘后释放，全部编译完成才读回并合并计数。父进程重新核验完整初始输出、逐次摘要、源码/二进制身份、profile hash/区间/数量，并从原始图重算摘要。

`summary.json` 是可上传的脱敏结果。worker 的 `report.json`、`profile-*.json` 含原始路径或完整输出，只保留本地。合并图只提供计数，没有连续时间轴；GC、idle 与未归因样本保留在分母中，inclusive 项重叠，不可相加。位置是 Inspector 返回的转换后位置，没有做 sourcemap 反查。

这不是耗时配对实验。固定执行次序、loader/诊断计数、Inspector 开销及共享机器负载均会影响样本，不能根据样本比例推导加速倍率。V8 无法给出 Rust 内部栈或整个进程全部线程的 CPU；本工具也不证明冷构建、HMR、RSS 或真实小程序 runtime 收益。

CI 默认运行正确性矩阵；`Native AST Analysis` 的 `optimized-compiler-cpu` 输入另行启用三平台归因，使用独立 concurrency group，仅上传顶层脱敏摘要。
