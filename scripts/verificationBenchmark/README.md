# 验证链路性能采集

这里只比较验证工具的耗时，不替代现有 Nightly Performance 的产品性能门禁。正式采样期间固定源码，串行执行同一组框架输入和逻辑场景；基线与候选各至少三轮，使用同一 OS、Node、provider、平台、runner 类型及缓存策略。

## 本地完整验证采集

正式本地墙钟样本使用 `node --import tsx scripts/verificationBenchmark/cli.mjs local --config .tmp/local-config.json --output .tmp/local-baseline-1.json`，调用原有 `pnpm verify --mode full`，同时覆盖静态检查、构建、单测、类型契约、内部契约、完整 headless 和原 `e2e:full` 的 CI、Web、严格真实 IDE。配置示例：

```json
{
  "schemaVersion": 1,
  "id": "baseline-1",
  "variant": "baseline",
  "comparisonProtocol": "same-main-topology-v1",
  "topology": "legacy-v1",
  "mode": "full",
  "base": "origin/main",
  "jobs": 4,
  "cachePolicy": "build-warm-serial-cohort-v1",
  "inputPolicy": "framework-tree-v2"
}
```

必须先提交并合入全部共同源码，完整本地与真实 IDE 采样均遵守“干净主工作区、main、HEAD 与 origin/main 一致”的约束。`same-main-topology-v1` 比较合并后同一个最终 main 的重建拓扑；它不能重建已经错过的历史基线，也不能称为历史提交的实测。两侧必须保持相同 revision、sourceFingerprint、输入、完整逻辑范围、实际工具链、资源和缓存过程，各串行至少三轮成功样本。记录执行顺序，不能回切旧提交、改写远端引用或把顺序采样称为交替采样。最新稳定 IDE、登录和机器租约要求保持完整；缺失条件保留非成功样本，不能用于提速验收。

正式配置必须显式设置 `comparisonProtocol: "same-main-topology-v1"`，baseline 只能为 `topology: "legacy-v1"`，candidate 只能为 `topology: "optimized-v1"`。策略不属于资源 profile 或逻辑 scope；versioned policy digest 和独立 executionTopology 贯穿计划、实际 child 环境、任务 receipt、suite execution 与样本。未知策略、继承冲突、缺失身份或混合策略均拒绝。历史通用比较格式继续兼容，但不能作为此新协议的样本。

本地采集的 `frozen.json` 与 runtime 输出旁的 `.frozen.json` 在启动前保存完整任务定义、拓扑身份和实际命令，仅记录两项拓扑环境变量；采集后回读其摘要并由样本引用。所有正式 child suite（包括嵌套 HMR）必须报告启动前冻结的 task definition hash，缺失 hash 不得按兼容默认值视为通过。保存原始输入、frozen receipt、全部报告和样本，不能覆盖已有正式轮次。

采集 API 在启动前以独占写入保留每个输出的 `.capture.json` 轮次声明，并把路径、摘要和 run ID 绑定到样本；结束时再次核验摘要。runtime 每轮归档四个路径：样本、`.inputs.json`、`.frozen.json` 和 `.capture.json`。任一路径已存在时立即拒绝，后续输入、冻结回执与最终样本也各自独占写入，防止并发覆盖。本地采集同样独占输出及 `.capture.json`，原始输入、冻结回执和日志在独占创建的 run ID 目录中保留。失败后不删除声明或已有证据，重试必须选择新的输出；这项输出保护不替代 E2E 机器租约。输出名不能使用 `.inputs.json`、`.frozen.json`、`.capture.json` 这些保留后缀。

仅有两个成对切点：legacy 全部 fixture 串行且 exhaustive TDesign 四个源文件分别执行；optimized 只把已审阅十四个隔离 fixture 文件移入 fast，TDesign 使用一个 aggregate child。最终 globalSetup 的 body/placement、完整 full 任务、调度器、owner/清理和观察器两侧共同，不恢复固定等待。完整任务清单只允许精确 TD4→1 展开，其他任务、非适用项、case 与 checkpoint 不得消失。这两个切点不保证全链路必达 30%；未达标时依据本轮实际 phase 定位，不能添加基线等待。

`cachePolicy` 是本轮实际遵守的缓存准备策略名称，采集器不会清理共享缓存。示例策略在每侧合入 main 后先执行一次相同的 `pnpm build:pkgs`，随后连续完成三轮；只预热包构建，不声称全链路已经预热。若要比较全链路热缓存，每侧先额外执行一轮完整验证并排除该预热轮。保留原始 Turbo 实际执行与缓存命中证据，不清理其他任务的共享缓存。两侧共同使用相同 CPU、worker、构建预算及内存可用量探针；共同资源修正不计入被测提速。

输入使用与 CI 同一 `framework-tree-v2` 完整 Git tree 策略和显式 JSON 投影，拒绝手填 `inputFiles` 或覆盖命令。采集前冻结真实 verify 计划、资源预算、正式 suite 清单与严格 IDE case/template 清单；执行期间逐任务保留原命令、完整日志、真实退出状态、Turbo dry graph/actual summary、实际 Vitest 文件与全部 case 状态。仅专用采集模式追加 observer reporter，ESLint/stylelint 只增加 JSON 格式及独占输出位置，保留原范围、跳过策略和失败阈值。

正式 build、types 包装重建和 Turbo 前置 build 完成后记录新的 schema 2 包产物清单，后续 consumer 开始前核验最新清单；全程源码必须固定。原重复构建保留在原始证据内，比较逻辑叶子集合时去重，并把既有 `test:types:check` 与 `test:types` 视为同一公开类型门禁。所有 suite、实际 Vitest invocation 和严格 IDE DOM 子报告必须完整属于本轮，缺失、旧报告、失败、取消或 partial 均不算成功。

普通 consumer 结束后及整轮完成后再次核验完整产物清单，最后一个任务内的未声明写入、新增或删除也不能成为成功样本。合法产物写入仅由 build、类型构建及真实 Turbo 图中的 build 任务刷新清单。

`.tmp/verification-benchmark/<run-id>/` 保留原始计划、任务日志、全部实际 case、完整输入 receipt 和报告；样本通过相对路径及摘要引用这些证据。产品与验证工具用例沿用已审计分类策略，未知文件仍属于产品。真实 IDE 比较完整逻辑 fixture/case/checkpoint；headless 保留原文件分配，同时比较唯一的 template/完整 case 名集合，名称歧义时拒绝比较。CPU/worker/build 并发预算及继承的并发配置也进入比较身份，避免换资源预算冒充工具提速。

`mode: "quick"` 与 `mode: "review"` 可记录原始反馈耗时，仍保留原有 `remaining` 和 partial 语义，不能作为完整本地成功样本。旧 `capture` 只测一条单测命令，`runtime` 只测指定真实 IDE suite；两者都不能代替 `local` 的完整链路。当前尚未完成两侧各三轮完整本地实测。

## 本地单测采集

使用 `node --import tsx scripts/verificationBenchmark/cli.mjs capture --config <config.json> --output <sample.json>`。配置示例：

```json
{
  "schemaVersion": 1,
  "id": "baseline-1",
  "variant": "baseline",
  "cachePolicy": "warm",
  "command": "pnpm",
  "args": ["exec", "vitest", "run", "--config", "@weapp-core/constants/vitest.config.ts", "--reporter=json", "--outputFile=.tmp/verification-benchmark/tests.json"],
  "report": ".tmp/verification-benchmark/tests.json",
  "inputFiles": ["@weapp-core/constants/src/index.ts"]
}
```

`inputFiles` 必须列全实际框架输入，不能只挑选没有变化的文件。采集器从真实宿主取得工具链身份，检查执行前后 Git 内容指纹，并读取本轮新生成的 Vitest JSON。失败、跳过、重复用例、报告缺失和源码漂移不会产生成功样本。测量命令使用结构化参数，不经 shell 拼接。缓存运行需要保存和恢复完整测试证据，不能复用上轮遗留 JSON 冒充本轮结果。

## CI 时间拆分

正式 CI 比较先冻结独立的 `.github/verification-workload.json`。它从原生 PR CI 已审批的根 merge tree 读取，只为清单明确点名的 PR 追加共同 profile；正常路径选择仍取并集。采集器重新读取不可变 manifest 和 profile 配置，逐项复算 `pathSelections`、`selectionSources`、最终选择及原始字节摘要，并要求实际选中的 profile 集合精确等于完整工作量。head 模式子流程的投影 context 不能替换根 merge 身份。两侧 profile 或 manifest 原始字节不同，即使局部产品用例相同也不能比较；不提供强制全跑开关或手工填写范围的捷径。

使用 `node --import tsx scripts/verificationBenchmark/cli.mjs ci --repository <owner/repo> --run <run-id> --config <topology.json> --output <evidence.json>`。此命令只读 GitHub API 和下载 artifact，不批准或启动工作流。配置的 `needs` 必须逐项覆盖该轮所有实际 job 名称和依赖；有条件跳过的非适用 job 必须在 `outOfScope` 中写明原因，并与 API 的 skipped 状态一致。

```json
{
  "schemaVersion": 1,
  "identity": {
    "repository": "owner/repo",
    "prNumber": 42,
    "runId": 123456,
    "runAttempt": 1,
    "event": "pull_request",
    "workflow": ".github/workflows/ci-pr.yml",
    "headSha": "<40 位 HEAD SHA>",
    "baseSha": "<40 位 BASE SHA>",
    "driverSha": "<40 位 MERGE SHA>",
    "checkoutSha": "<与 driverSha 相同>",
    "checkoutMode": "merge"
  },
  "cohort": { "id": "baseline-1", "variant": "baseline" },
  "contract": ".github/verification-benchmark.json",
  "needs": {
    "Approve PR checks": [],
    "Freeze approved PR target": ["Approve PR checks"]
  },
  "outOfScope": {}
}
```

上例仅展示配置结构，`needs` 要补齐实际全图。`identity` 所有字段都必须与真实运行及下载的 `pr-context` 一致，未知字段也会拒绝。采集器核对 repository、workflow、attempt、head/base/merge，读取 merge commit 验证两个 parent。每个实际执行作业的 run/attempt 与执行区间必须属于当前轮；API 标记为新 attempt 但仍保留旧执行时间的复用作业也会拒绝。

artifact 的全量 API 清单保留在 `artifactInventory`。先核对全量身份，再以当前 attempt 时间窗隔离旧归档，只允许本轮唯一且未过期的同名 artifact 进入发现或采集。下载按核验后的精确 ID 获取二进制 ZIP，核对 REST 大小、SHA-256、路径安全、解压预算及文件 CRC；不用按名称取首项的下载方式。并发引用共享同一个进行中的下载，全部下载结束后才释放本轮独占目录，成功和失败均会清理。

## 自动准备 CI 契约

先使用一轮已成功完成的原生 PR CI 做 discovery：`node --import tsx scripts/verificationBenchmark/cli.mjs prepare --repository <owner/repo> --run <run-id> --config <policy.json> --output <preparation.json>`。`policy.json` 包含完整 `profile`（字段同正式契约）、`cohort: { "id": "discovery", "variant": "baseline" }`，以及可选 `contract` 路径。此命令从已验证的 `pr-context` 和冻结 YAML 自动展开本地 reusable workflow，保留源码的全矩阵 barrier 与平台内依赖，不从耗时猜图。返回实际完整 `configuration`、待审 `contract`、输入审计 `receipt` 和证据缺口 `gaps`。同名 skipped 占位作业以 `{ "reason": "…", "expectedCount": 2 }` 精确声明；执行作业继续要求名称唯一。

生成器使用版本化 `inputPolicy` 自动枚举冻结 tree 中全部框架包、应用、模板、fixture、补丁、依赖/工作区配置及构建脚本，避免手填不完整源码列表。摘要算法为 `sha256-of-git-blob-sha1-and-explicit-json-projections-v1`，包含策略全文、相对路径、文件模式和不可变 blob 身份。只对策略逐项列出的验证字段做 JSON 投影：根 `package.json` 的 `scripts.verify`、`scripts.verify:plan`、`scripts.test:pure`，constants/hmr 两个 manifest 的 `scripts.test:pure`，以及 `turbo.json` 的 `tasks.test:pure`。Turbo 的 build inputs、dependsOn、globalDependencies 及其它依赖、引擎与 build 脚本保留。排除的验证目录、文件和投影键均列入策略与 receipt；改变策略自身也会改变摘要。symlink、submodule、缺失锁文件或 Turbo 配置和不完整 tree 会拒绝，新增框架或 fixture 文件自动进入清单。

版本化动态报告引用可使用 `{ "artifact": "…", "filePattern": "**/*-suite-report/index.json", "expectedCount": 1 }`；DOM 报告允许同一个引用精确展开多份。只支持 `*`/`**`，限定 artifact 临时目录并拒绝 symlink；缺少、重复或多出的文件都会失败，不能任取最新报告。

准备结果始终带 `draft: true`，采集器拒绝将其当作正式契约。审阅全部输入策略、实际 job 全图与逻辑范围，补齐每类执行证据后，通过 `node scripts/verificationTelemetry/contractCli.mjs finalize-contract --preparation=<preparation.json> --expected-ids=<已审计精确 ID 数组.json> --output=.github/verification-benchmark.json` 生成非草稿合约，并提交到正式采样分支。缺失 coverage、runtime 或 task-suite 任一层、存在证据缺口或 ID 清单不符时拒绝生成。discovery 不计入三轮。当前尚未完成 CI 基线/候选各三轮实测；历史成功 baseline 没有上传完整 coverage inventory、原生执行 blob 与原阈值 verdict，不能追补为完整样本。必须在两侧加入相同的附加证据采集，保留各自原执行命令及阈值，再开始六轮完整运行。普通 `ci-pr`/`ci-full` 有意使用非严格 DOM 模式，通过独立 `task-suite` 证据验证 frozen plan、所有实际 shard 及 aggregate，范围明确为 task 全集与定义，不声称 DOM case/checkpoint 完整；缺失任一实际报告继续留在 `gaps`，不能由准备演算得出提速结论。部分重跑若复用旧 attempt artifact，也不能计作完整轮次。

## CI 执行证据

工作量 manifest 与本节执行契约各自承担独立约束：前者冻结共同 profile 和审批范围，后者绑定本轮实际输入、完整 job 图和执行证据。准备结果及正式契约均保存 `workload` receipt，采集时必须与不可变根 context 完全一致。

每个变体的三轮正式样本必须保持同一 revision 和 `sourceFingerprint`。对固定提交使用完整的「重新运行所有作业」，为当前 attempt 重新取得审批与完整证据；不能用空提交刷新轮次，不能将只重跑失败作业、复用旧作业或旧归档的部分执行计入三轮。discovery、失败、取消和证据不完整的运行均只保留原始记录。比较前仍须完成两侧各至少三轮完整成功运行，不能用历史发现或演算补足轮次。

`contract` 必须已存在于该轮冻结 merge tree 中，采集器通过不可变 Git blob 读取并核对字节身份。其结构包含 `schemaVersion: 1`、自动展开的 `inputPolicy`（兼容旧的显式 `inputFiles`，二者互斥）、资源策略 `profile`、该轮 `needs` / `outOfScope`，以及实际证据引用数组 `evidence`。不接受传入 `inputDigest` / `scopeDigest` 替代验证。每个 coverage 引用包含 `id`、`kind: "coverage"`、预期实际工具链 `profile`（`os`、`arch`、`nodeMajor`、完整 `nodeVersion` 和 `packageManager`）、预期项目/文件集合 `scope`、`plan`、`shards` 和 `verdict`；文件引用统一为 `{ "artifact": "实际 artifact 名", "file": "artifact 内相对路径" }`，每个 shard 还须提供实际 blob 相对路径 `blob`。采集器复用严格分片校验、核对实际 blob 摘要及原覆盖率阈值合并 verdict，实际集合必须与预期一致。

新 discovery 使用 `scopeLevel: "audited-cases"`，先核对每轮完整真实项目/文件分配和全部 `[file, fullName, state]`，再按版本化 `scopePolicy` 分类。产品用例必须精确一致；只有策略明确列出的验证基础设施回归属于 validation，未知文件和新增 simulator 产品回归默认属于 product。每个变体的完整 validation 集合、原始 skipped 状态、分类规则及两类计数仍固定在不可变合约并保存到 `inventories`；失败、pending、缺失或重复一律拒绝。比较摘要包含完整策略与 product 集合，因此可以单独新增工具回归，但不能声称两侧总用例数相同。`framework-tree-v2` 也显式排除附加 `scripts/verificationTelemetry/` 实现，排除凭据继续保留。

原覆盖率布局与阈值定义 `vitest.coverage.ts` 同时进入两侧框架输入摘要，逐字节绑定；不能只依靠每侧不同配置各自的 `configHash` 声称阈值相同。

`task-suite` 引用包含 `scopeLevel: "tasks"`、冻结计划 `plan`、逐 shard 报告 `shards`、完整汇总 `aggregate` 和构建 manifest `toolchain`。它只接受非 strict 计划，复用仓库的 `aggregateVerificationReports` 逐一核验 task 分配、definitionHash、身份、退出码和结果，再核对实际 aggregate 全部执行字段；基线原四分片不增加汇总 job，显式使用 `aggregateMode: "verified-shards"` 从全部实际分片生成并保留 aggregate receipt，不能同时声明上传的 aggregate。缺片、重复、失配、失败、dirty 状态或实际 Node/pnpm/OS/arch 不符均不产生样本。预期 `scope` 为排序后的 `[taskLabel, definitionHash, outOfScopeReason|null]`，不把 task 范围提升为 DOM 验收范围。

runtime 引用使用 `kind: "runtime"`、完整 suite 报告引用 `suite`、DOM 验收报告引用数组 `acceptance`、对应构建工具链 manifest 引用 `toolchain` 和逻辑 case/checkpoint 集合 `scope`。严格 DOM 验收及实际 Node 版本均须匹配。资源身份从实际证据提取，工具链同时绑定完整 Node 与 pnpm，不能用配置中的 Node major 冒充实际环境。版本化配置只能证明预期；缺少实际完整证据时输出 `sample: null` 的原始时间报告及 `incompleteReason`，不能用于中位数验收。证据齐全时直接输出比较器可读的 sample。

审批等待取同一 gate deployment 的 `waiting → queued`。调度等待是各 job 的 `created → started` 总和，gate 使用审批后的 queued 时间；它是排队总量，不等于流水线墙钟时间。执行关键路径按完整依赖图上的实际 job 执行区间求最长路径，runner 毫秒为所有实际 job 执行区间之和。报告保留原始 API 时间，缺少审批证据、身份不符、失败或取消均拒绝验收。

## runtime 与中位数比较

`runtimeScope` 复用现有严格 DOM 验收校验器，从完整成功报告提取逻辑 case、route、checkpoint、节点、属性与样式契约；会话聚合前后的文件分组变化不改变逻辑范围。局部筛选和 shard 自身不构成完整性能样本。真实 IDE 的租约、预检、启动、连接、首屏、用例和清理时间继续使用 E2E 阶段计时。

比较命令为 `node --import tsx scripts/verificationBenchmark/cli.mjs <baseline-1.json> <baseline-2.json> <baseline-3.json> <candidate-1.json> <candidate-2.json> <candidate-3.json> --output <comparison.json>`。样本格式由 `capture` 输出，包含输入摘要、场景摘要、源码指纹和资源身份；CI/IDE 适配时必须使用实际执行证据填写同一格式。比较器分别输出审批、排队、执行与 runner 成本中位数，仅在实际执行关键路径下降至少 30% 时返回成功。失败与 partial 样本列为 excluded，不补零、不纳入成功样本。

本地单测采集中的 runner 毫秒等于单机命令墙钟毫秒；CI 的 runner 分钟按 `runnerMs / 60000` 换算。不能把离线 LPT 估计、历史演算或局部验证称为本轮实际提速。

## 本地真实 IDE runtime 采集

先提交待测源码，重建受影响包并准备下游产物；需要完整包产物时执行 `pnpm build:pkgs`。采样要求干净的已知提交，构建不能代替源码身份校验。完成最新稳定 IDE 版本、登录态及执行租约预检后，按仓库要求串行采样。采集器沿用正式 suite 的睡眠抑制、预检与清理流程。

在根目录创建 `.tmp/prepare-runtime.mjs`，使用实际 Git、Node、pnpm 和全部现存包级产物生成 schema 2 清单：

```js
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 与正式 suite 一致地跨平台解析 pnpm。
import { execa } from 'execa'
import { createBuildArtifactManifest } from '../scripts/buildArtifact/index.mjs'

const root = process.cwd()
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const pnpm = (await execa('pnpm', ['--version'])).stdout.trim()
const manifest = createBuildArtifactManifest(root, {
  BUILD_ARTIFACT_EXPECTED_COMMIT: commit,
  BUILD_ARTIFACT_PACKAGE_MANAGER: `pnpm@${pnpm}`,
})
await writeFile('.tmp/runtime-toolchain.json', `${JSON.stringify(manifest, null, 2)}\n`)
```

运行 `node .tmp/prepare-runtime.mjs`，再创建 `.tmp/runtime-config.json`。正式 runtime 仅接受固定的完整 `framework-tree-v2` 策略，不接受手填 `inputFiles` 或缩减后的策略：

```json
{
  "schemaVersion": 1,
  "id": "baseline-1",
  "variant": "baseline",
  "comparisonProtocol": "same-main-topology-v1",
  "topology": "legacy-v1",
  "suite": "ide-full:exhaustive",
  "cachePolicy": "warm",
  "toolchain": ".tmp/runtime-toolchain.json",
  "inputPolicy": "framework-tree-v2",
  "artifactDirectories": ["packages/weapp-vite/dist"]
}
```

执行 `node --import tsx scripts/verificationBenchmark/cli.mjs runtime --config .tmp/runtime-config.json --output .tmp/runtime-baseline-1.json`。`suite` 只接受 `ide-full` 或 `ide-full:exhaustive`，分别调用原有 `e2e:ide:full` 与 `e2e:ide:full:exhaustive` 脚本；输出必须位于 `.tmp/`。输入从真实干净 checkout 的完整 `git ls-tree` 自动展开，复用 CI 的框架输入规则和精确 JSON 字段投影；验证脚本的允许差异不改变框架摘要，构建脚本、依赖、模板和 fixture 变更仍进入摘要。普通输入绑定 Git 模式与不可变 blob SHA，投影 JSON 按 SHA 读取并复验 blob；不逐文件启动子进程。完整策略、路径/模式/摘要清单及排除/投影凭据保存在输出旁的 `.inputs.json`，样本绑定其路径和摘要。采样前后核对真实提交、tree、源码身份和自动输入摘要，生成报告不会掩盖源码变更。

`artifactDirectories` 为可选附加检查，清单内全部 `dist`/`bin` 文件及新增、删除的产物仍始终核验。每次修改源码或重建产物后重新生成工具链清单，采样执行前后输入凭据、工具链与完整产物清单必须一致。

任务及 case/template 清单从被测工作树自身的正式 `getSuiteTasks` 与 `readPlannedTaskCases` 在启动前冻结，实际报告必须逐项完整匹配。exhaustive 正式保留的三项 swan 非适用任务允许存在，但其 label、reason、零耗时/退出码和空 artifact 必须与正式 manifest 一致；配置不能声明豁免。继承的 task filter/from、shard、template、target、exclude 和 selected cases 均拒绝，适用任务也不能临时改成范围外。

本轮 TDesign 会话聚合只在 `ide-full:exhaustive` 正式清单内，IDE 提速验收两侧均使用此完整 suite；原 `ide-full` 与 `verify --mode full` 继续各自原范围，不能据此宣称已测到 TDesign 的会话收益。

每轮使用唯一 run ID，读取本轮标记对应的 suite 报告及其全部 DOM invocation，保留原始报告路径和摘要。资源身份取自实际工具链及 case 证据，包含完整 Node/pnpm、OS/arch、真实 IDE 和各 fixture 基础库版本；基线与候选必须一致。失败、取消及缺失证据只生成非成功样本，不能进入成功中位数。两侧至少各三轮完整成功采样后，使用前述比较命令验收；单个聚合任务的局部加速不代表完整 suite 已达到目标。
