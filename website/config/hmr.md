---
title: 开发态 HMR 配置
description: 说明 weapp.hmr.runtime、sharedChunks、touchAppWxss、logLevel 与 profileJson 的默认行为、适用场景和取舍。
keywords:
  - 配置
  - config
  - hmr
  - classic
  - sharedChunks
  - touchAppWxss
  - logLevel
  - profileJson
---

# 开发态 HMR 配置 {#hmr-config}

`weapp.hmr` 用来控制开发态更新时的“稳定性 vs 速度”取舍，也可以打开更细的终端诊断与结构化 profile 输出。本页覆盖：

- `weapp.hmr.sharedChunks`
- `weapp.hmr.runtime`
- `weapp.hmr.touchAppWxss`
- `weapp.hmr.logLevel`
- `weapp.hmr.profileJson`

[[toc]]

## `weapp.hmr.runtime` {#weapp-hmr-runtime}

- **类型**：`'auto' | 'classic' | 'stateful-experimental'`
- **默认值**：`'auto'`
- **微信 WebView**：`auto` 在项目热重载设置开启且编译器能力满足时启用状态保持；否则使用 `classic`。显式 `classic` 始终完整发布，`stateful-experimental` 仍受能力检查约束。

安全的原生 Page、Component 和 Wevu/Vue 脚本更新保留当前实例、页面 data、输入、交互及 store 状态。JSX/TSX 和 React 更新遵循对应编译器的注册与模块边界，不能仅凭文件扩展名判断安全。

模板字节变化、编译后样式变化、JSON 配置、入口拓扑或不兼容注册会自动切换到 classic。最新 Stable 尚未提供可靠的状态保持模板和样式应用确认契约：写出 WXML/WXSS 不代表页面已应用，因此这类更新使用完整发布。classic 重置运行状态；后续编辑、撤销和配置重启继续使用 classic，本次 dev 命令不再尝试切回，重新启动后再检测。

普通编译或业务异常保留原始诊断，不视为能力降级，也不推进成功交付版本。修复源码后的下一次保存继续重试。旧 build 或旧客户端的确认不能完成新批次。

开发日志分别记录请求模式、实际模式和降级原因。构建发布、脚本执行确认与 IDE 完整刷新是不同阶段；文件写出成功或协议重连成功不能代替真实页面内容和计算样式已更新。未连接 IDE 时仍可正常构建，不能把构建完成解释为 runtime 通过。

classic 会临时将当前项目私有配置的 `setting.compileHotReLoad` 设为 `false`，避免局部脚本热重载与完整刷新竞争。正常关闭并成功释放构建器和 watcher 后恢复原请求值，保留其他用户字段及登录态。配置和资产租约在原生发布阶段交接；产物始终由 Vite/Rolldown emit/write 写出。

内置 Tailwind 按当前源码生成候选和样式；CSS Modules 同时编译类名映射和样式。普通 WXSS、外部样式、CSS 变量、局部优先级、样式删除及恢复都需要验证最终页面效果。

非微信平台和 Skyline 使用 classic。真实 runtime 验收范围为微信 IDE；其他平台只统计已执行的构建回归。

### 独立 HMR 回归命令

正式清单包含 stateful、事务交付、classic 及在线降级，覆盖 `wv`、Vite 和 Vite+ 宿主。所有计划内 task、case 和 checkpoint 必须完成；不能通过排除失败场景或重开 headless VM 声称真实 IDE 已自动刷新。

| 命令 | 覆盖范围 |
| --- | --- |
| `pnpm test:hmr` | 模式、watcher、编译事务、交付确认、降级、simulator 与验收基础设施单测 |
| `pnpm e2e:hmr:build` | 完整 HMR 构建、watch、共享依赖、多平台降级及源码恢复 |
| `pnpm e2e:hmr:headless` | provider-compatible runtime 场景及完整 checkpoint |
| `pnpm e2e:ide:hmr` | 真实微信 IDE 状态保持、完整刷新、页面数据、节点、样式及交互 |
| `pnpm e2e:hmr:acceptance` | 同一干净提交下先单测，再串行运行以上三层并汇总证据 |
| `pnpm e2e:ide:full:exhaustive` | 全仓完整 IDE 功能验收，包括非 HMR 场景；按仓库规则在合入后的干净最新 main 执行 |

`pnpm e2e:hmr:regression` 是综合验收兼容入口。HMR 专项不能代替全仓完整 IDE 验收。原 `:diagnostic` 命令继续可用；历史 classic 清单也保留供对照。[历史失败记录](./hmr-regression-history.md)不因本轮范围调整改写为通过。

修改源码后先重建受影响包。正式验收要求已提交且干净的工作树，冻结任务与用例清单，独立记录 provider；单独运行某层只证明该层。综合入口保存单测 stdout、stderr、Vitest JSON 和收据。

所有本机 E2E 共用机器串行租约，IDE 阶段保持系统唤醒并记录实际安装、基础库及资源释放证据。通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 固定安装。环境失败、资源清理失败、筛选或未执行都不能计为完整通过。正式入口拒绝 `--allow-failures`、`--filter`、`--from`、shard 和模板筛选，证据写入 `.tmp/e2e-hmr-acceptance/<runId>/`。

## `weapp.hmr.sharedChunks` {#weapp-hmr-sharedchunks}
- **类型**：`'full' | 'auto' | 'off'`
- **默认值**：`'auto'`
- **适用场景**：开发态 HMR 时控制共享 chunk 的重建策略。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      sharedChunks: 'auto',
    },
  },
})
```

取舍说明：
- `full`：每次更新都重新产出全部 entry，最稳但最慢。
- `auto`：只在共享 chunk 可能被覆盖时回退到 `full`，是默认折中方案。
- `off`：仅更新变更 entry，最快，但共享 chunk 导出关系复杂时更容易出现开发态不一致。

建议：
- 普通项目保持默认 `auto`。
- 遇到“开发态偶发错乱、刷新后恢复正常”的共享 chunk 问题时，优先尝试 `full`。
- 只有在你确认项目结构简单且极度在意 dev 重建速度时，再考虑 `off`。

## `weapp.hmr.touchAppWxss` {#weapp-hmr-touchappwxss}
- **类型**：`boolean | 'auto'`
- **默认值**：`'auto'`
- **适用场景**：需要兼容全局样式刷新时，在开发态增量构建结束后额外更新已有 `app.wxss` 的时间戳。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      touchAppWxss: 'auto',
    },
  },
})
```

行为说明：
- `true`：每次增量构建结束后刷新已存在的全局样式。微信开发者工具可能因此重载 AppService 并重置页面状态。
- `false`：关闭额外刷新；Tailwind 内容扫描、样式编译与正常产物更新仍会执行。
- `auto`：只为非内置 Tailwind 集成中已确认的内容失效补充全局刷新。内置 `weapp.tailwindcss` 由 compiler 与 Vite/Rolldown 原生输出负责更新，不再重复触碰全局样式。普通页面、组件或 layout 的局部样式更新不会触发该行为；祖先目录中可以解析到 Tailwind 依赖也不会启用它。

该选项不会创建缺失的 `app.wxss`，也不会改写构建器生成的内容；除文件不存在以外的刷新错误会输出到开发日志。

适用建议：
- 一般保持默认值；`touchAppWxss` 不改变 `weapp.hmr.runtime` 的能力判断；无法可靠应用的样式更新仍自动切换 classic。
- 只有确认需要每轮全局重载的旧集成才显式开启 `true`。

## `weapp.hmr.logLevel` {#weapp-hmr-loglevel}

- **类型**：`'default' | 'concise' | 'verbose'`
- **默认值**：`'default'`
- **适用场景**：控制 HMR 终端日志的详细程度。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'concise',
    },
  },
})
```

行为说明：

- `default`：只输出总耗时等基础信息，适合日常开发。
- `concise`：输出关键阶段耗时，适合定位“哪一类更新慢”。
- `verbose`：输出更完整的阶段诊断，适合排查 HMR 链路异常。

建议：

- 日常保持 `default`。
- 只有在定位 HMR 慢、共享 chunk 回退或 DevTools 热重载不稳定时，再临时提高到 `concise` 或 `verbose`。

## `weapp.hmr.profileJson` {#weapp-hmr-profilejson}

- **类型**：`boolean | string`
- **默认值**：`false`
- **适用场景**：输出 HMR 结构化 profile，方便后续脚本、AI 或报告工具分析。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      profileJson: '.tmp/weapp-vite-hmr-profile.jsonl',
    },
  },
})
```

行为说明：

- `false`：不输出结构化 profile。
- `true`：使用默认 profile 输出路径。
- 字符串：写入指定 JSONL 文件路径。

> [!TIP]
> 当你需要把 HMR 诊断交给 AI 或 CI 侧脚本复盘时，优先开启 `profileJson`，再结合 `logLevel: 'concise'` 或 `verbose` 缩小问题范围。

## 关联阅读

- [共享 Chunk 配置](/config/chunks.md)
- [共享配置](/config/shared.md)
- [调试指南](/guide/debug.md)

## 宿主共享编译内核（实验）

`@weapp-vite/hmr` 提供固定输入批次、编译 provider 契约、资产提交状态、补丁映射和交付事务；`@weapp-vite/tailwindcss` 在同一份 `weapp-tailwindcss/core` 快照下生成样式并转换模板与 JS。它们都是 Node 侧工具，不包含页面、布局、框架运行时或监听器。

weapp-vite 的 `weapp.hmr`、`weapp.tailwindcss` 和可选 `prepareHmr` 类型保持兼容。宿主继续创建 DevEngine、接入模块图与监听、通过原生 emit/write 输出，并决定传输与应用确认边界。Taro 的实验接入保留 React Refresh、PatchJournal 和既有 HMR 模式；持久发布确认与应用确认分别记录。

首期针对微信做双宿主运行时验收，支付宝与抖音仅验证编译产物和适配契约。完整重同步仍是完整重同步；已记录的微信 IDE 模板/样式缓存限制不会因为拆包而自动消失。实验接入与固定版本重现脚本见仓库 `integrations/shared-hmr-tailwind`。

### JSONL 消费契约

新记录使用 `schemaVersion: 1`，保留原有平铺耗时、事件和文件字段。`sessionId` 区分构建服务会话，`buildId` 区分一次构建；classic 合并更新还提供 `batchId` 和完整 `sourceEvents`（事件 ID、文件、事件类型、接收时刻）。单文件旧字段继续可读，多文件消费者应从来源列表匹配，不能把没有来源的记录归给当前编辑。`correlation: 'unknown'` 表示没有足够的来源证据。

`timestamp` 是 UTC 发布时刻，阶段耗时与 `sourceEvents[].receivedAtMs` 使用同进程 `performance.now()` 时钟，`clock.timeOrigin` 给出时钟原点。不同进程的单调时钟值不能直接相减。`batchWaitMs` 表示收集批次的等待，`queueWaitMs` 表示串行构建队列等待；文件稳定等待发生在上游 watcher，当前无法独立观测时保持缺失，不能用外部墙钟减去内部阶段来推断。

`status: 'complete'` 才能进入正常耗时统计。失败记录为 `failed`，只提供 `elapsedMs`，不提供成功的 `totalMs`。未影响任何入口的批次记为 `incomplete`，并附 `reason: 'no-affected-entries'`；其观测状态随批次结束，不混入下一次构建。未完成、未知版本、损坏行与缺失阶段不会被补为 0；`analyze --hmr-profile --json` 的 `inputCoverage` 报告旧版、兼容、不兼容、未完成和无效行数，各阶段的 `count` 表示实际观测数。没有版本的旧记录继续兼容，旧字段缺失时保持未知。

阶段可能相互包含，不能相加当作总时间。`buildCoreMs` 保留旧口径，但由 `estimates.buildCoreMs` 明确标记为残差估算，不是独立计时；`snapshotBuildMs` 包含 snapshot 准备与构建。外部产物可见时间单独记录，不能冒充内部编译时间。

原始 JSONL 和 `createCompilerContext()` 的 `runtimeState.build.hmr.profile`、`recentProfiles` 还提供以下可选诊断字段；未执行或未观测到的字段保持缺失。这些字段目前不进入 `analyze --hmr-profile` 的 `metrics` / `operations` 聚合：

- `vueGenerateBundleMs` 是 Vue 资产阶段的整体耗时，包含逐入口累计的 `vueBundleRefreshMs`、`vueBundleAssetsMs` 以及 fallback 页面处理，不能把它与子项再次相加。
- `generateRewritePrepareMs`、`generateRewriteAnalysisMs`、`generateRewriteNpmMs`、`generateRewritePlatformMs`、`generateRewriteRequestGlobalsMs`、`generateRewritePreludeMs`、`generateRewriteRuntimeMs` 是 `generateRewriteMs` 内依次记录的连续区间；它们仍是内部阶段，不能替代源文件修改到产物可见的外部 `wallMs`。
- `vueBundleEligibleCount` 记录本轮选中的编译缓存入口数，`vueBundleEmittedCount` 记录成功完成资产发布的入口次数（包含 fallback）；它们不表示产物发生变化的文件数。`vueBundleCacheHitCount`、`vueBundleRecompileCount`、`vueBundleStyleOnlyCount`、`vueBundleFallbackCount` 分别记录缓存复用、发起重新编译、仅样式刷新和成功 fallback 的路径次数，重新编译计数也可能包含随后失败的尝试。
- `rewriteAnalysisCacheHitCount` / `rewriteAnalysisCacheMissCount` 记录跨 chunk 内容分析缓存的命中与未命中；不包含本代 WeakMap 直接复用和无需分析的 chunk，因此不能直接作为整个 bundle 的缓存命中率。

stateful 记录带有 `pipeline: 'stateful'`。`sourceToBatchMs` 只表示源通知到批次接收的已观察间隔，不假称原生 bundler 的全部耗时。core 转交源事件时保留原始 `eventId`、`event` 和 `receivedAtMs`，异步失效处理计入源通知到批次的间隔，不在 stateful 接收回调时重置时钟。交付批次依次记录 `deliveryQueueMs`、`prepareMs`、`commitQueueMs`、`commitMs`、`publishMs`，快照批次记录 `snapshotBuildMs`、`snapshotPublishMs`。`completionBoundary` 区分 `delivery-acknowledged` 与 `output-published`；发布包含客户端确认等待时，不能直接拿来替代更早发生的产物可见时间。失败、取消和未完成的批次不会进入成功统计。

分析 JSON 的 `timelines` 提供各批次互不重叠的外层阶段、残差和归因状态。standard 的批次等待、队列等待已包含在 `watchToDirtyMs`，因此其他构建前时间为三者差值，不能重复相加。stateful 与 standard 分别解释；无法匹配唯一源事件、阶段缺失或出现负残差时保留 `null` / `partial`，不以零填补。benchmark 的预算和编辑/恢复样本选择统一使用 `wallMs`，内部 `totalMs` 仅保留实际 profile 值。

一次编辑的消费方式是先记下 JSONL 当前行位置，再修改源文件，等待输出断言通过后，从新增的兼容、完成记录中按 `sourceEvents[].file` 精确匹配。仓库可运行示例为 `scripts/benchmark-templates-hmr.ts`，匹配逻辑与回归在 `scripts/benchmarkTemplatesHmr/profile.ts`；找不到关联时返回 `missing`，外部观察结果单独保留。


### 编辑序列与观测开销

仓库的 `verify:edit-sequence` 复用同一序列驱动器，将长期增量会话的每一步与全新进程基线比较；失败保留首个分歧和可重放输入。新增 `--resource-cycles 60 --report <file.json>` 可记录额外的有界连续编辑：

```sh
pnpm verify:edit-sequence --engine classic --resource-cycles 60 --report .tmp/edit-classic.json
pnpm verify:edit-sequence --engine stateful-experimental --resource-cycles 60 --report .tmp/edit-stateful.json
```

两条命令必须串行执行。每步报告 load/transform 调用及模块集合、原生产物发布文件与字节、stateful 补丁次数与字节、RSS/heap、Node 活动资源类型、进程监听器和会话句柄，结束后检查工具拥有的子进程已退出。它们来自 compiler/native fixture；不能把 load 数量解释为框架脏入口数，Node 活动资源也不等于原生 watcher 的全部内部资源。

资源门禁跳过最初三个样本，按四个样本一个窗口计算中位数。持续上涨和上涨后保持高位都会触发门禁：进程及进程树 RSS 32 MiB、强制 GC 后 heap 16 MiB、GC 时长增长 50 ms、GC 次数增长 2；进程、资源、监听器、会话和转换范围计数不允许增长。缺少进程树、强制 GC 或构建范围观测时失败；不足三个窗口报告 unknown。GC 和进程树采样在编辑计时之外，原始值、采样耗时与强制回收标记均保留。一次峰值不能证明泄漏，门禁失败表示需要结合原始样本调查。

完整框架资源入口为 `--engine weapp-classic` 和 `--engine weapp-stateful`，默认 512 个真实 Vue SFC 页面、14 次连续保存。它们沿用同一 driver、长期 Vite/Wevu 编译宿主与每步独立新进程基线，通过 mpcore 执行全部页面 JS、比较 data/逻辑文本/WXML，以及完整产物集合和非 JS 字节。stateful 使用实际回环 transport 和 emitted delta；classic 只按宿主重载边界重建测试 VM，编译进程不重启。这里的 heap/RSS 包含测试 runtime，不能冒充纯编译器内存或真实 IDE 页面帧验收。

调试驱动本身时可传 `--framework-pages 2` 缩小 fixture；正式大项目资源验收保留默认 512 页，报告会记录实际页面数量。每步计时包含全部页面的重新进入、语义观察及产物扫描，只用于固定规模下的资源和 profile 开销比较，不能解释为单次 HMR 可见延迟。

```sh
pnpm --filter weapp-vite build
pnpm verify:edit-sequence --engine weapp-stateful --require-clean --report .tmp/framework-profile-off.json
```

profile 开关对照按 off/on/on/off 顺序串行运行四次相同命令，分别设置 `WEAPP_VITE_HMR_PROFILE_JSON=0` 和 `1`，并写入独立报告。两组对照采用相反顺序，减轻机器随运行时间变化带来的偏差。例如预算为 5% 时，运行：

```sh
pnpm exec tsx scripts/editSequence/compareProfiles.ts 5 .tmp/framework-profile-off.json .tmp/framework-profile-on.json .tmp/framework-profile-off-second.json .tmp/framework-profile-on-second.json
```

比较器要求相同干净提交、输入摘要、逐步语义摘要和已完成资源清理；开启时每次编辑必须有同一 worker 时间窗口内的真实完整源事件，关闭时不得产生 profile 记录。报告保留各组预热后耗时中位数和相对开销，以两组相对开销的中位数判断显式预算。它与模板 benchmark 的外部 HMR `wallMs` 是不同观测口径，不能混排。

比较 profile 开销时，使用相同的 `TEMPLATES_HMR_MARKER_SEED`、场景、迭代次数与源码，分别设置 `TEMPLATES_HMR_PROFILE=1` 和 `0`。每个样本保存输入 SHA-256；关闭 profile 时报告 `profileStatus: 'disabled'`，只比较同口径的 `wallMs`，不等待 profile、不伪造内部阶段。此开关仅控制 JSONL profile；采样器自身的输出轮询和内存探针仍保持一致。


### dev/prod 与外部缓存的输出所有权

发布前运行 production 构建。推荐让开发输出与可缓存的生产输出使用不同目录，例如 `dist-dev` 与 `dist`；Turbo 的 `outputs` 只登记生产目录，开发任务设置 `cache: false`、`persistent: true`。缓存键应包含源码、配置、锁文件、目标平台与影响构建的环境变量。不要把开发目录叠加到缓存命中的生产目录再统计包体积。

Vite/Rolldown 负责构建产物的 emit/write。默认清理策略适用于构建器独占的输出目录；共享目录采用 `build.emptyOutDir: false` 时，当前构建上下文只撤销它已登记的旧产物。新进程、新上下文和 Turbo 恢复的文件不会自动变成本次构建的旧产物，框架不能根据扩展名猜测哪些文件可删除。

必须共用目录时，缓存集成需要持久记录每个任务的产物清单及内容摘要，并负责恢复前后的差集清理。清单来自成功构建的 `writeBundle` 结果，清理只针对上一份清单中的文件；文件已被其他工具改写时应报告冲突并保留，未知文件不得删除。恢复来自可信缓存、路径须校验，恢复操作不能与 dev/watch 同时进行。真实构建仍由原生 emit/write 完成，缓存恢复不应注入到 HMR 兜底逻辑中。

仓库 `scripts/editSequence/outputCache.ts` 是隔离测试目录中的集成示例，并非对任意用户目录开放的缓存 API。它按已登记字节撤销旧文件、恢复先前原生构建的快照，并拒绝同名用户内容冲突；实际缓存系统还需自行处理并发、符号链接、事务失败和缓存可信性。

可串行执行以下组合回归：

```sh
pnpm --filter weapp-vite build
pnpm verify:edit-sequence --engine weapp-modes --require-clean --report .tmp/output-mode-sequence.json
```

该观察器使用完整 weapp 插件，覆盖 production→dev→production、dev→production、组件移动/删除、页面及分包迁移/删除、共享依赖变化，以及旧生产缓存恢复。每步完整生产磁盘文件集合及字节与独立进程基线比较，检查 emitted JS 引用和路由文件存在性；`emptyOutDir: false` 额外验证每次切换都保留用户文件。它验证的是模式切换后的产物，不测量编辑 HMR 延迟，也不能替代真实 IDE 页面验收。

`--require-clean` 要求源码已提交且无未跟踪项目文件，报告绑定实际提交与干净状态，避免把本地未提交修改归因于候选提交。

### 原生编辑类别与输出范围采样

仓库内的 `scripts/benchmark-templates-hmr.ts` 支持 `TEMPLATES_HMR_PROJECT_ROOT` 指定独立工程。工程中的 `hmr-benchmark.json` 显式列出源文件、目标产物和变更类型；参考 `e2e-apps/github-issues/fixtures/issue-1134-profile`，包含原生 JS、WXML、普通 WXSS、WXSS 导入链、SCSS、Tailwind 内容、局部 JSON、组件引用和页面路由九类编辑。

拓扑编辑只有在目标 JS/JSON/WXML 全部生成后才完成；恢复阶段也须确认这组产物已撤销。classic 刷新当前可达入口，stateful 的入口集合变化会回退 classic，不承诺保持旧实例状态。`emptyOutDir: false` 下仅移除当前构建持有且已不可达的文件，保留用户资产。

启用 `TEMPLATES_HMR_OUTPUT_SCOPE=1` 后，报告在计时窗口外记录实际磁盘文件的新增、内容变化、删除及变更后字节数。它不代表底层 write 调用次数，不计相同字节的重复写入；也不能把它直接解释为模块转换成本。使用相同 marker seed 与输入摘要比较样本。完整重载、局部资源更新和脚本补丁分别解释，不混用其延迟或状态保持语义。
