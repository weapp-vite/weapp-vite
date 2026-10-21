---
title: 开发态 HMR 配置
description: 说明 weapp.hmr.runtime、sharedChunks、touchAppWxss、logLevel 与 profileJson 的默认行为、适用场景和取舍。
keywords:
  - 配置
  - config
  - hmr
  - stateful
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
- **适用场景**：在微信开发者工具中更新原生 Page、原生 Component 或 wevu Vue SFC 时，保留当前页面实例、路由参数、输入和可序列化 data/setup ref。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      runtime: 'stateful-experimental',
    },
  },
})
```

`auto` 会在 `wv dev` 启动时读取微信项目的 `project.private.config.json`：当 `setting.compileHotReLoad` 严格为 `true` 时使用 `stateful-experimental`，否则使用 `classic`。非微信平台也会回退到 `classic`。该判断只发生在启动阶段，修改微信开发者工具设置后需要重启 `wv dev` 才会重新选择模式。启动日志会显示最终模式、选择来源，以及通过 DevTools 热重载开关或 `weapp.hmr.runtime` 切换模式的方法。显式配置通常优先，但 Skyline 兼容降级不受显式配置覆盖。

`stateful-experimental` 目前只支持微信小程序平台。它使用 Vite bundled dev graph 和微信 App Service 内的增量补丁协议，安全的 JavaScript/Vue 脚本更新会在现有实例上替换方法并恢复状态。不改变运行时注册和配置的模板、样式及静态资源更新走资产同步；页面是否实际应用新内容，仍需检查运行时与渲染结果。

遇到以下能力边界时，当前开发会话会交回 `classic`，由完整构建和微信 IDE 刷新接管后续保存，不继续承诺保留实例状态。即使显式选择 `stateful-experimental`，这些边界仍然生效。

| 变更或环境 | 处理方式 |
| --- | --- |
| 安全脚本增量，或不改变注册与配置的模板、样式、静态资源 | 状态保持补丁或资产更新 |
| 小程序 JSON 配置、页面/组件/依赖入口拓扑变化 | 回退 `classic`，重新建立完整构建图 |
| Vue SFC 编译模板的注册结构变化，包括 `<template src>` | 回退 `classic`，重新编译模板生成的计算、事件和渲染注册 |
| DevEngine 要求完整重载，原生注册或增量模块结构不兼容 | 回退 `classic`，验收新页面的默认状态和更新后的事件 |
| 编译 provider 缺少事务式 HMR，或构建器/运行时能力缺失 | 回退 `classic`，记录具体能力原因 |
| 非微信平台或 Skyline | 使用 `classic` |

回退在同一开发会话内保持生效，重启开发服务后才重新评估状态保持能力。交接期间的新保存仍须进入最终构建；旧状态保持会话、传输和 watcher 完成关闭后，后续编辑由 classic 宿主处理。普通编译错误和业务异常继续作为错误报告，不会因为发生异常就被归类为“不支持 HMR”。

状态保持开发期间，weapp-vite 会临时在 IDE 私有配置中排除输出目录内静态资源的原生监听，避免 PNG 等资源变更触发整页重编译。资源仍由 Vite 写出，运行时按路径重新读取时可获得最新内容。代码、模板、样式和 JSON 配置继续交给 IDE 处理。JSON 声明的资源（包括 tabBar 图标和主题图标）保留在 IDE 原生文件索引中，其变更仍由 IDE 编译处理。会话关闭或下一次构建前会恢复原有监听配置，并保留用户在会话内修改的其他设置；发布前请运行正式构建，不直接使用开发产物。

Vue `<style module>` 同时参与样式和脚本类名映射的编译。修改其内容、模块名称或 `src`，以及新增或移除该块时，会将脚本与样式一起纳入更新，避免后续脚本补丁引用未交付的样式模块。独立的普通 `<style>` 变化仍按纯样式处理；真实页面是否已经应用颜色需要在 DevTools 中验证。

内置 Tailwind 将对应的样式与 JavaScript 作为一个编译批次处理：先完成资产提交，再发布全部补丁，最后根据客户端执行回报通知 DevEngine。样式生成或写入失败时不发布该批次补丁，后续更新可以重试；最终样式内容未变化时不重复写入。写入成功与页面已经应用新样式是不同的阶段，排查视觉更新时还需检查实际页面的计算样式。

样式合并按真实文件身份判断所有权：已由模块图处理的样式，即使又通过符号链接、目录连接或 Windows 路径别名被发现，也不会作为独立原生样式重复读取并合并。固定输入批次保持该批次的样式内容，不混入同一文件较新的磁盘保存；真正独立的原生同名样式仍参与输出，移除显式样式导入后仍保留原生样式回退。

回退时，同一输出当前收集到的多个 sidecar 按收集顺序合并后一次发布，不会相互覆盖；指向同一真实文件的重复路径只保留一份。常规 HMR 更新按完整合并内容去重，而不是分别缓存每个片段。

上述保证不涵盖原生样式文件删除事件对历史登记集合的清理；本次修复没有验证或改变该上游生命周期。

微信开发者工具[暂不支持 Skyline 热重载](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/compatibility.html#%E5%B8%B8%E8%A7%81%E7%9A%84%E5%85%BC%E5%AE%B9%E9%97%AE%E9%A2%98)。首次编译检测到任意生成的应用或页面 JSON 使用 `renderer: 'skyline'` 时，`wv dev` 会输出兼容性警告，将当前项目私有配置中的 `setting.compileHotReLoad` 持久化为 `false`，并强制使用 `classic`，即使用户显式配置了 `stateful-experimental`。其他私有配置字段不会改变；切回 WebView 后需要由开发者按需重新开启热重载。

使用前请确认：

- 微信开发者工具已开启服务端口，并在项目设置中启用热重载。
- `project.private.config.json` 的 `setting.compileHotReLoad` 为 `true`。
- 当前项目没有使用 Skyline；Skyline 会自动关闭 DevTools 热重载并降级为 `classic`。
- 这是实验能力；需要完全沿用既有写盘/刷新语义时显式配置 `classic`。
- 状态恢复只覆盖可序列化的小程序 data 和 wevu setup ref；定时器、网络连接、原生句柄等副作用仍应由应用生命周期管理。

### 独立 HMR 回归命令

仓库将状态保持支持、启动即使用 classic 的功能覆盖，以及从 stateful 交接到 classic 的回退放在同一份语义场景清单中。每个场景引用运行时能力矩阵的稳定 ID；这些引用说明验收范围，不直接证明某次失败的根因。回退场景继续检查编辑、刷新后的页面内容、事件和源码恢复；只有重复执行同一契约的任务才合并。

| 命令 | 覆盖范围 |
| --- | --- |
| `pnpm test:hmr` | HMR 能力选择、会话交接、compiler/runtime、simulator 及验收基础设施单测 |
| `pnpm e2e:hmr:build` | 构建、watch、自动路由、共享依赖及 classic 回退产物 |
| `pnpm e2e:hmr:headless` | provider-compatible 状态保持及回退场景的完整 case/checkpoint |
| `pnpm e2e:ide:hmr` | 真实微信 IDE 的增量状态保持、渲染结果与 classic 自动刷新 |
| `pnpm e2e:hmr:acceptance` | 先运行 `test:hmr`，再串行运行以上三个 E2E 层，汇总同一提交的完整证据 |

历史 IDE 审计中的 26 个失败 case 按原 task 与 case ID [逐项映射到回归入口](./hmr-regression-history.md)。HMR 分层覆盖其中 18 个，其余 8 个继续保留在完整 IDE suite；映射表不表示这些失败已修复，也不将连接、加载或 MCP 失败归因于 HMR。

能力覆盖计划另行记录 unit、build 和真实 runtime 场景。stateful→classic 场景覆盖 `config-json`、`native-registration`、`entry-topology` 和运行时 bridge 能力缺失；缺少 `prepareHmr` 的 compiler provider 另有启动回退场景。运行时和编译器能力缺失均覆盖 `wv`、Vite 和 Vite+ 的 auto/显式 stateful 配置，检查 classic 更新、后续编辑、源码恢复和配置重载。

引擎完整重载（`engine-full-reload`）、React 模块结构（`patch-shape`）、Skyline 启动边界及 Vue 编译模板注册（`native-registration`）已接入独立的微信 IDE/headless 场景，覆盖真实输入变更、后续 classic 保存及源码恢复。编译模板场景保留混合 script/template/style 保存、模板生成计算与事件、两轮结构编辑/恢复和外部模板 `src` 的功能检查；独立原生 WXML 仍保留原有覆盖。这些场景与其他已接入场景均标记为 `planned`，表示测试已纳入清单；某轮是否 `passed`，仍须复核同一提交的实际任务、case 和 checkpoint 报告。新增测试、单测通过或覆盖映射均不能作为真实 IDE 已通过的证据。

非微信 `platform` 的真实 runtime 仍为 `pending`，本轮只纳入其 CLI/dev 产物回归，未执行其他平台真实 IDE。综合报告的验收范围是微信 runtime 与跨平台构建；只有这两部分必需证据齐全时，才可标记 `passed-for-scope`，同时保留全局 runtime 覆盖 `incomplete` 及非微信未执行原因。缺少必需能力、未知能力或跨平台构建证据时，全量命令保留不完整报告并失败。原有 classic 功能测试不能代替独立的回退证据。

wevu Tailwind TDesign 模板回归分别检查两种更新契约：纯 script/style 保存及恢复保留实例与点击计数；背景静态 class、模板属性或局部节点变化走编译模板注册边界并交接 classic。后一部分保留背景改、删、加、改的连续更新、局部样式优先级、默认状态与新交互、后续保存及完整源码恢复；真实 IDE 通过原窗口自动刷新验收，headless 仅证明新产物可运行。

`pnpm e2e:hmr:regression` 保留为综合验收的兼容入口。全部 IDE 功能的最终验收仍运行 `pnpm e2e:ide:full:exhaustive`，HMR 专项通过不能代替它。

修改源码后先重建受影响包，再运行下游测试。三个 E2E 专项要求源码已提交且工作树干净；每层冻结任务和用例清单，独立记录 provider，复验完整 checkpoint 后才汇总。综合入口先通过跨平台子进程执行真实 `pnpm test:hmr`，保存 stdout、stderr、Vitest JSON 与单测收据；收据必须包含实际执行且全部通过的非空用例，执行前后均为同一干净提交。三个 E2E 层通过但缺少有效单测收据时，不能生成 `scope=full` 成功报告。单独完成构建层或 headless 层只代表该层通过，不能据此宣称真实 IDE 已通过。headless 的重建测试 VM 也不能证明 IDE 已自动刷新。

单测与综合验收的三个 E2E 层共用机器串行租约，真实 IDE 阶段保持系统唤醒。环境故障、资源清理失败、未执行、跳过或局部筛选均不计为完整验收；专项命令拒绝 `--allow-failures`、`--filter`、`--from`、shard 和模板筛选。报告保留在 `.tmp/e2e-hmr-acceptance/<runId>/`，其中 `unit/` 保存单测输出和收据，各 E2E 层保存冻结计划和复验报告；仅在租约清理完成并重新确认提交及工作区后写最终汇总。失败保留原始分层报告，不用后续成功覆盖。单独运行 build、headless 或 ide 入口时不强制执行单测，成功报告保持 `scope=stage`。

需要排除独立组件库时，在运行前统一设置 `WEAPP_VITE_E2E_EXCLUDE_PROJECTS=uview-plus-compat,wot-ui-compat`。微信 IDE 安装通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 显式固定；测试和回退不会主动注销开发者账号或清理登录数据。

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
- 一般保持默认值，让局部样式更新保留页面交互状态。
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
