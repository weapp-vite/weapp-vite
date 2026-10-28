# 基线验证证据

此目录只给原验证流程增加可核验的执行证据。基线保留原 job、`needs`、matrix、并发、命令、任务顺序、旧 `partitionE2ETasks` 分配和原覆盖率阈值。`baseline-topology.json` 固定这些原契约，附加输入不参与拓扑比较。

拓扑回归从实际 `validate-ci.yml` 的三个质量入口判别变体：原 `reusable-node-command.yml` 使用基线快照，优化后的 `reusable-quality-platform.yml` 使用 `candidate-topology.json`，未知或混合入口直接失败。基线快照保持原样；候选快照另行冻结外层入口及 quality、miniapp、consumer 子流程的完整 job，包括原生步骤、环境、失败策略、matrix 和依赖。两侧分别检查原覆盖率成功后才生成 verdict、四分片原生合并阈值成功后才上传 Codecov 的顺序，不能把基线拓扑断言跳过后当作候选校验通过。

`candidate-topology.json` 是当前候选 workflow 的预期测试契约。变更已审阅的 workflow 后，从其既有七个文件读取完整 `jobs` 同步该契约，继续检查每个步骤、环境、失败策略及依赖；测试运行时不会自动重写预期值。2026-10-26 依赖迁移同步了候选固定 Node 版本及支持矩阵，并补齐此前已合入的两个 Windows 诊断 job、HMR functional-only 表达式，以及 miniapp classic suite、headless 预检日志和诊断工件路径。`baseline-topology.json` 保留原字节，历史 benchmark 配置、运行工件及性能报告也保持原样。

候选测试契约不包含采样耗时、运行身份或验收工件，更新它不会补齐或重写历史性能证据。正式 CI 采集从该轮不可变 revision 的真实 YAML 与实际 GitHub jobs 建立拓扑，再核对已提交的 benchmark 合约和本轮工件；新的候选契约不能用于宣称旧样本采用了新工具链或新拓扑。

启用方式是现有 reusable job 的 `verification_telemetry: true`。没有启用时，root Vitest 配置与 suite 入口不加载证据 reporter 或计划。候选优化流程共享逻辑范围、显式分类、资源核验、基线证据发现和合约生成 helper，其原生四分片 reporter 直接记录真实 case，不使用基线调度入口。

覆盖率仍执行原样的 `pnpm test:coverage`。附加 reporter 在真实 `onTestRunStart` 冻结项目/文件清单，在真实 `onTestRunEnd` 记录每个 case 的完整名称和状态，同时保留原默认 console reporter，并启用 Vitest 原生 blob。测试结束本身不会生成通过判定；只有原 `Run command` 成功后，独立 finalizer 才核对实际清单、完整工具链、配置摘要和 blob，写出原阈值的成功 verdict。阈值失败、取消、缺失或重复执行不能产生完整证据。

覆盖范围使用 `[file, fullName, state]` 的逻辑 case 集合，允许调度优化把同一文件从 serial 项目移动到 fast 项目。每一轮仍独立证明真实项目/文件分配精确、无漏项且无重复；逻辑 case 本身也不能重复。`skipped` 状态保留并参与精确比较，`pending`、失败和取消均拒绝。

discovery 使用版本化 `coveragePolicy.mjs` 显式分类：产品集合参与跨变体精确比较；只把逐项列出的验证工具回归归入 validation，未知文件及 simulator 产品回归均保持 product。两侧新增的工具回归可以不同，但完整实际工具用例、分类规则和两类计数都保留，并与各自冻结合约精确核对；任何工具失败或缺失仍拒绝本轮样本。不能把相同产品场景表述成相同总测试集合。`framework-tree-v2` 仅把附加 telemetry 实现列入验证目录排除，策略全文和排除凭据均进入输入审计。

普通 suite 的计划在原 build job 冻结，通过已有 build artifact 传给原运行 job。原报告继续保留；另存 `plan.json`、实际 `shard.json` 和真实 schema2 `toolchain.json`。单分片直接复验并产出 `report.json`；原 `ci-full` 四分片保持原拓扑，由收集器对全部实际 shards 执行相同聚合校验，并把完整 aggregate receipt 保存到 CI 证据中。严格 headless suite 仍使用原 full 报告和实际 DOM case/checkpoint 证据，不降为 task 级证明。

工件名称为：

- `coverage-plan-<os>-node-<major>`、`coverage-shard-<os>-node-<major>-1`、`coverage-complete-<os>-node-<major>`。
- `verification-suite-<原 suite artifact 名称>`，内含上述 suite 证据。收集器同时支持基线和候选原有的 plan/shard/aggregate 命名。

`os.mjs` 只显式映射 GitHub 官方的 `Linux`、`Windows`、`macOS` 与 Node 的 `linux`、`win32`、`darwin`，其余值拒绝。核对平台、架构和实际完整 Node/pnpm 版本时使用明确映射，原工件的实际值继续保存在资源证据中。

验证后的 discovery 仍是草稿。审计完整 evidence ID 清单后，可生成能提交的非草稿合约：

```sh
node scripts/verificationTelemetry/cli.mjs finalize-contract \
  --preparation=.tmp/verification-benchmark/preparation.json \
  --expected-ids=.tmp/verification-benchmark/expected-evidence-ids.json \
  --output=.github/verification-benchmark.json
```

`expected-evidence-ids.json` 是已审计的精确 ID 数组。缺失任何执行层、存在证据缺口、改变冻结拓扑、覆盖率没有真实 logical cases 或 evidence ID 增减都会拒绝生成正式合约。生成不代表完成性能采样；正式比较仍需要各三次独立、完整、经过原生批准的运行。

验证命令：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/verificationTelemetry
pnpm exec eslint scripts/verificationTelemetry vitest.config.mts e2e/scripts/run-e2e-suite.ts
```

微型 smoke 使用真实 Vitest 命令、原生 blob 与真实阈值失败验证时序，不是框架 E2E，也不计入性能样本。候选四分片集成另核验四个真实 shard、native merge、不重跑 case、原 100% 阈值及 Vite 原生 emit 后的 schema2 产物。

本地完整验证采样由外部 `verificationBenchmark` 采集器运行此基线工作树。基线只保留同字节的任务执行观察依赖和 Vitest reporter；只有明确设置专用采样环境时才启用，原任务图、命令、测试发现、覆盖率阈值和 DOM reporter 均保留。采集器实现与 CLI 留在候选侧，不能将观察输出本身当作完整通过证明。

`optimized-v2` 通过审批后读取的 `.github/verification-workload.json` 显式选择：可选字段 `verificationTopology` 只接受 `optimized-v1`、`optimized-v2`，仅对 `pullRequests` 点名的 PR 生效；默认继续使用 v1。拓扑进入冻结上下文，入口和实际任务核对同一字段，不能在下游换成另一种拓扑。已有 PR 审批、只读权限与原始覆盖率阈值保留。

v2 将 Ubuntu 的 32 个独立消费者场景调度为四个确定性批次，每个场景仍各自安装和运行原消费者入口，保留原 DOM/Web 证据。权重是 `static-relative-v1` 静态相对值，报告另存真实耗时；失败或取消后剩余场景明确记录为未执行，完整汇总拒绝缺失、重复、篡改、跨 attempt 或非成功退出的证据。Node 支持保留五个逻辑角色，当最低版与当轮解析的最新版完整版本一致时共享实际执行，汇总逐角色核对原始 consumer 与 Dashboard 字节。

v2 的产物消费者先恢复 dist 后执行一次完整安装，生产者保留原生构建后的链接刷新；miniapp/headless 汇总从 plan job 生成的固定 bundle 执行，不安装 workspace。bundle、plan、源码 SHA 及完整原始 case/checkpoint 证据继续核对。Playwright 缓存按 OS、架构、包版本和 browser revision 精确匹配，PR 只读，可信默认分支可写；Linux 的系统依赖安装始终保留。浅 checkout 是默认，HMR 审计等明确依赖历史的 job 保留完整历史。

候选完整快照随本次 v2 分支同步，另以 `optimized-v1-inventory.json` 保留变更前已审查的默认 job、命令、matrix、依赖和产物输入，验证 v1 的执行语义没有被新增分支替换。长 workflow 继续维持原平台职责，独立的安装、冻结身份和浏览器缓存收敛到 composite action，场景清单与汇总实现拆为脚本；避免为了文件行数把安全依赖藏入多层调用。

PR #1258 将 legacy Node support 的 Chromium 安装拆为 Linux 安装系统依赖、Windows/macOS 仅安装浏览器。候选快照与 v1 清单只同步这一已审阅的兼容修正，其余 job、消费命令、matrix、依赖和产物契约不变；`baseline-topology.json` 及历史 benchmark 证据保持原字节。

PR #1277 将 DOM acceptance internal job 的总预算由 15 分钟提高到 30 分钟，以覆盖 macOS 的依赖缓存恢复和完整合同检查。候选快照与 v1 清单同步这一预算，执行命令、任务范围和验收断言保持原样；固定性能基线、采样规则、5% 门槛及历史 incomplete 证据不变。

正式同 revision 的 v1/v2 CI 比较可以在一次提交前审阅固定 attempt 映射；以下字段追加到现有 workload 清单，不改变点名 PR、base branch 和 profiles：

```json
{
  "verificationTopology": "optimized-v1",
  "verificationTopologyByAttempt": {
    "1": "optimized-v1",
    "2": "optimized-v2",
    "3": "optimized-v1",
    "4": "optimized-v2",
    "5": "optimized-v1",
    "6": "optimized-v2"
  }
}
```

每次使用 GitHub `Re-run all jobs`，由新 attempt 重新经过 `pr-ci-approval`，再从同一不可变清单按实际 attempt 冻结 topology。映射的 key 必须是正整数，值仅限 v1/v2；未列出的 attempt 使用 `verificationTopology`，再缺省为 v1。未被清单点名的 PR 始终使用 v1。采集器必须从同一原始 blob 按实际 attempt 复算并校验该选择；不能修改清单来凑同 revision，也不能沿用上一轮审批。冷/热缓存状态和审批后耗时均采集真实运行证据，不补造清缓存操作或声称每轮冷启动。
