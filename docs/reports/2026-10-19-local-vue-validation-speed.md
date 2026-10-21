# Vue 单测验证链路配对基准

2026-10-19，在相同机器、工具链、产品源码、用例集合和 warm 缓存策略下，通过根 Vitest 配置执行 12 个既有 Vue 测试文件。基线与候选各完成三轮，墙钟中位数由 **5,412.183 ms 降至 3,431.113 ms，下降 36.6039%**。

这份结果只衡量该子集的测试发现、配置加载、setup、转换、测试执行和报告写出。它不代表全部本地验证、构建、类型检查、coverage、CI 或真实 IDE 的提速，也不能代替这些范围各自的三轮验收。

## 本轮结果与身份

| 轮次 | baseline 执行 / ms | candidate 执行 / ms |
| --- | ---: | ---: |
| 1 | 5,324.255 | 3,431.113 |
| 2 | 5,643.383 | 3,352.495 |
| 3 | 5,412.183 | 3,542.880 |
| 中位数 | 5,412.183 | 3,431.113 |

每轮都是 **12 文件、168 用例全部通过**，无失败、skip、todo、重复或缺失用例。比较器的 `excluded` 为空；`meetsTarget: true` 仅适用于本表中的 Vue 子集。下降比例为 `1 - candidate 中位数 / baseline 中位数`。

- baseline revision：`41c4efe0a77978ab0fb41d2075577baf73d4f6ea`。
- candidate revision：`206e5e22bb5e3140b3343b14566fe3b621dc61d7`。
- baseline 源码指纹：`e68d399c9a3e3a2c3d3ef0276e0d0afe034d6becb2dd48b22e5d2e5decbe6017`。
- candidate 源码指纹：`02c92994fc5328a025b84f6bd26b762efd0fda0237c3531cb916d0ccd41f7e74`。
- 两侧 `inputDigest`：`f45ea49dce6deccab08be9bb5a9a63be7cd537f1cf2d06fef20dbf8a766e8375`。
- 两侧 `scopeDigest`：`90b685bf4a2e71a3be83ae469c6a515d5fbfaff28333ffd504749f67f3576d05`。
- 比较结果 `identityDigest`：`439725984d5f64fbd10773f241ebfe1494d5e03a3c7949c6cf0b1d0fc573eae2`。

提交与源码指纹共同绑定每侧快照；同侧三轮均一致。后续工作流归属修正不属于上述 candidate 快照，不能用本表冒充后续提交的重新采样。

## 范围、环境和输入边界

环境为 `darwin` 本地 runner、Node `v24.18.0`、pnpm 声明版本 `12.11.2`。实际安装的 Vitest 为 `5.0.5`、Vite `8.3.4`、Rolldown `1.2.14`、tsx `4.23.15`、TypeScript `6.0.3`，两侧一致。复现前也需核对实际 pnpm 与声明一致。

固定 `maxWorkers=2`，关闭 coverage 和可选 native AST，使用根 `vitest.config.mts` 与 `--configLoader bundle`。baseline 保留旧全局 setup 与串行分区；candidate 保留所属项目 setup 与已审核的并行分区。未引入新增的 fixture 隔离测试来改变基准集合。

测试文件都位于 `packages/weapp-vite/test/vue/`：

```text
advanced.test.ts
class-style-runtime.test.ts
compiler.test.ts
component-json.test.ts
emit-assets.test.ts
json-macros-strip.test.ts
native-page-layout.test.ts
resolver.installation.test.ts
runtime-export.test.ts
script-setup-define-model.test.ts
script-setup-define-props-emits.test.ts
sfc-integration.test.ts
```

`scopeDigest` 绑定排序后的“仓库相对文件路径 + 完整用例名”，不依赖项目名、执行顺序或耗时。12 个测试文件的完整代码也进入输入摘要，防止仅保留名称却改变断言。

`inputFiles` 共 2,430 项：2,429 个直接文件加一份派生的 `loader-contract.json`。直接文件包括以下完整集合：

1. 从 `weapp-vite`、`wevu`、`@wevu/compiler` 出发，沿本地 `dependencies`、`optionalDependencies`、`peerDependencies` 得到 27 个产品包。
2. 这些包中受 Git 跟踪的 `src/**`，以及 `schemas`、`misc`、`modules`、`bin`、`types`、`store` 下的运行资产；包根层的 `tsconfig*.json`、`tsdown.config.*`、`*.cjs`。排除 `.test.`、`.spec.`、`__tests__` 和 Markdown。
3. 上述 12 个测试文件、`test/vue/moduleGraph.ts` 与 `test/pluginHook.ts`。
4. 根 `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.npmrc`、`tsconfig.base.json`，以及 workspace 声明的 Vite/Rolldown 两份依赖 patch。

loader contract 投影包的版本、入口、exports、imports、依赖、peer、可选依赖、engines、sideEffects、开发依赖和发布入口，以及根工具链声明与实际安装工具版本。排除 package scripts，因为本次测量对象正是验证工具的实现变化。

Vitest 配置、分区、setup、fixture 工具和验证脚本由各侧源码指纹冻结，保留实现差异；不将其当作必须相同的产品输入。27 个包的 dist 均已预构建，采集器核对每侧本轮执行前后的完整产物清单和内容摘要。dist 不参加跨 worktree 输入相等比较，以免 chunk 名和绝对 sourcemap 引入无关差异。

## 本地重现原始证据

准备 baseline 与 candidate 两个独立 checkout，分别固定到上述快照。在两侧安装相同锁文件、构建 `weapp-vite` 及其上游并刷新 injected workspace 链接。使用包含采集器的同一份工具 checkout；采样期间不再编辑任何一侧源码，不与构建、E2E 或其他重负载交叠。

每侧将完整具体输入清单保存为 `.tmp/verification-benchmark/input-files.json`，将上述 loader 投影保存为 `.tmp/verification-benchmark/loader-contract.json`，将 27 个包的 dist 相对目录保存为 `.tmp/verification-benchmark/artifact-directories.json`。两侧 loader 文件必须逐字节相同，`inputFiles` 也须包含该文件本身。目录和 glob 不能直接充当 `inputFiles`。

以下代码在每个被测 checkout 中生成四份配置。输入清单按上一节完整规则展开，禁止只挑选未变化的 Vue 文件：

```js
import { readFile, writeFile } from 'node:fs/promises'

const variant = 'baseline' // candidate checkout 改为 candidate
const directory = '.tmp/verification-benchmark'
const inputFiles = JSON.parse(await readFile(`${directory}/input-files.json`, 'utf8'))
const artifactDirectories = JSON.parse(await readFile(`${directory}/artifact-directories.json`, 'utf8'))
const names = [
  'advanced', 'class-style-runtime', 'compiler', 'component-json',
  'emit-assets', 'json-macros-strip', 'native-page-layout', 'resolver.installation',
  'runtime-export', 'script-setup-define-model', 'script-setup-define-props-emits',
  'sfc-integration',
]
for (const round of ['warmup', 1, 2, 3]) {
  const id = `${variant}-${round}`
  const report = `${directory}/${id}.vitest.json`
  const config = {
    schemaVersion: 1,
    id: `local-vue12-${id}`,
    variant,
    cachePolicy: 'warm;maxWorkers=2;coverage=false;native=false;rootVue12=v1',
    command: 'pnpm',
    args: [
      'exec', 'vitest', 'run', '--config', 'vitest.config.mts',
      '--configLoader', 'bundle', '--coverage.enabled=false', '--maxWorkers=2',
      '--exclude', '**/.codex-tmp/**', '--reporter=json', `--outputFile=${report}`,
      ...names.map(name => `packages/weapp-vite/test/vue/${name}.test.ts`),
    ],
    report,
    inputFiles,
    artifactDirectories,
  }
  await writeFile(`${directory}/${id}.config.json`, `${JSON.stringify(config, null, 2)}\n`)
}
```

capture 的当前目录必须是被测 checkout。两侧复用同一个工具 checkout 中的采集器；下例假定 checkout 位于仓库的 `.codex-tmp/` 下两层，因此相对工具入口为 `../../scripts/verificationBenchmark/cli.mjs`。不同布局只调整该入口，不改变被测目录或参数。

```sh
env -u WEAPP_VITE_NATIVE_AST_PATH WEAPP_VITE_NATIVE=0 WEAPP_VITE_NATIVE_NPM_CHUNK=0 WEAPP_VITE_TEST_MAX_WORKERS=2 NODE_ENV=test CI=1 node --import tsx ../../scripts/verificationBenchmark/cli.mjs capture --config .tmp/verification-benchmark/baseline-1.config.json --output .tmp/verification-benchmark/baseline-1.sample.json
```

替换配置和输出文件名执行其余轮次。每侧先运行一轮 `warmup`，保留 warmup 证据但不纳入中位数。实测顺序为 **baseline warmup → candidate warmup → baseline 1 → candidate 1 → candidate 2 → baseline 2 → baseline 3 → candidate 3**。不在轮次之间清理缓存或单侧补建 bootstrap。

将六份正式 sample JSON 汇集到工具 checkout 的 `.tmp/verification-benchmark/` 后比较：

```sh
node --import tsx scripts/verificationBenchmark/cli.mjs .tmp/verification-benchmark/baseline-1.sample.json .tmp/verification-benchmark/baseline-2.sample.json .tmp/verification-benchmark/baseline-3.sample.json .tmp/verification-benchmark/candidate-1.sample.json .tmp/verification-benchmark/candidate-2.sample.json .tmp/verification-benchmark/candidate-3.sample.json --output .tmp/verification-benchmark/local-vue12-comparison.json
```

原始 `*.vitest.json` 由本轮 Vitest 新写出，sample 记录其摘要、退出码、源码和产物身份。缺报告、跳过、失败、重复用例、输入漂移或产物漂移不能产生成功样本。原始 Vitest 报告可能包含本机路径，保留在本地 ignored `.tmp`；公开记录只引用仓库相对命令、摘要和汇总数据。

## 尚待覆盖的本地验收

本轮窄基准尚未测量真实变更下 `verify quick/review/full` 的完整执行图，也未测量构建、公开类型、冷缓存、coverage、不同 OS 或真实 IDE 的整体收益。纯测试缓存只对已经审核的 constants 与 hmr 开放；新增包须先证明隔离和缓存失效契约。共享 build/watch fixture 仍串行，后续扩大并行范围需要逐项证明资源归属与完整文件集合。

审阅还发现 full 与 review 的工具契约归属不一致、删除脚本或 E2E 工具输入不触发所属验证的问题。后续修正共用测试发现规则：full 执行根入口未覆盖的补集，quick/review 对脚本与 workflow 需求做并集，删除输入仍触发验证，相邻测试筛选只取仍存在的文件。集合回归、任务图、缓存证据与配置隔离共 11 文件、30 项测试通过，并通过范围 ESLint 和工具类型检查；这些修正不包含在本页六轮耗时中。
