# 基线验证证据

此目录只给原验证流程增加可核验的执行证据。基线保留原 job、`needs`、matrix、并发、命令、任务顺序、旧 `partitionE2ETasks` 分配和原覆盖率阈值。`baseline-topology.json` 固定这些原契约，附加输入不参与拓扑比较。

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
