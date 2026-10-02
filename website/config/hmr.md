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

`stateful-experimental` 目前只支持微信小程序平台。它使用 Vite bundled dev graph 和微信 App Service 内的增量补丁协议，JavaScript/Vue 安全更新会在现有实例上替换方法并恢复状态。可处理的模板和样式变化通过资产更新同步；JSON/配置、模块边界不兼容、补丁积压超过保留上限或补丁执行失败等情况使用完整构建回退。

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

阶段可能相互包含，不能相加当作总时间。`buildCoreMs` 保留旧口径，但由 `estimates.buildCoreMs` 明确标记为残差估算，不是独立计时；`snapshotBuildMs` 包含 snapshot 准备与构建。外部产物可见时间单独记录，不能冒充内部编译时间。当前 stateful benchmark 若没有编译 profile，继续报告 `unavailable-stateful`。

一次编辑的消费方式是先记下 JSONL 当前行位置，再修改源文件，等待输出断言通过后，从新增的兼容、完成记录中按 `sourceEvents[].file` 精确匹配。仓库可运行示例为 `scripts/benchmark-templates-hmr.ts`，匹配逻辑与回归在 `scripts/benchmarkTemplatesHmr/profile.ts`；找不到关联时返回 `missing`，外部观察结果单独保留。


### 编辑序列与观测开销

仓库的 `verify:edit-sequence` 复用同一序列驱动器，将长期增量会话的每一步与全新进程基线比较；失败保留首个分歧和可重放输入。新增 `--resource-cycles 60 --report <file.json>` 可记录额外的有界连续编辑：

```sh
pnpm verify:edit-sequence --engine classic --resource-cycles 60 --report .tmp/edit-classic.json
pnpm verify:edit-sequence --engine stateful-experimental --resource-cycles 60 --report .tmp/edit-stateful.json
```

两条命令必须串行执行。每步报告 load/transform 调用及模块集合、原生产物发布文件与字节、stateful 补丁次数与字节、RSS/heap、Node 活动资源类型、进程监听器和会话句柄，结束后检查工具拥有的子进程已退出。它们来自 compiler/native fixture；不能把 load 数量解释为框架脏入口数，Node 活动资源也不等于原生 watcher 的全部内部资源。

资源门禁跳过最初三个样本，按四个样本一个窗口计算中位数。最后三个完整窗口持续上升且超过阈值时失败：RSS 32 MiB、heap 16 MiB，资源/监听器计数为 0。不足三个窗口报告 unknown；一次峰值不能证明泄漏，门禁失败表示需要结合原始样本调查。正确性比较始终逐步执行，不因观测成本而省略失败恢复或完整基线。

比较 profile 开销时，使用相同的 `TEMPLATES_HMR_MARKER_SEED`、场景、迭代次数与源码，分别设置 `TEMPLATES_HMR_PROFILE=1` 和 `0`。每个样本保存输入 SHA-256；关闭 profile 时报告 `profileStatus: 'disabled'`，只比较同口径的 `wallMs`，不等待 profile、不伪造内部阶段。此开关仅控制 JSONL profile；采样器自身的输出轮询和内存探针仍保持一致。


### dev/prod 与外部缓存的输出所有权

发布前运行 production 构建。推荐让开发输出与可缓存的生产输出使用不同目录，例如 `dist-dev` 与 `dist`；Turbo 的 `outputs` 只登记生产目录，开发任务设置 `cache: false`、`persistent: true`。缓存键应包含源码、配置、锁文件、目标平台与影响构建的环境变量。不要把开发目录叠加到缓存命中的生产目录再统计包体积。

Vite/Rolldown 负责构建产物的 emit/write。默认清理策略适用于构建器独占的输出目录；共享目录采用 `build.emptyOutDir: false` 时，当前构建上下文只撤销它已登记的旧产物。新进程、新上下文和 Turbo 恢复的文件不会自动变成本次构建的旧产物，框架不能根据扩展名猜测哪些文件可删除。

必须共用目录时，缓存集成需要持久记录每个任务的产物清单及内容摘要，并负责恢复前后的差集清理。清单来自成功构建的 `writeBundle` 结果，清理只针对上一份清单中的文件；文件已被其他工具改写时应报告冲突并保留，未知文件不得删除。恢复来自可信缓存、路径须校验，恢复操作不能与 dev/watch 同时进行。真实构建仍由原生 emit/write 完成，缓存恢复不应注入到 HMR 兜底逻辑中。

仓库 `scripts/editSequence/outputCache.ts` 是隔离测试目录中的集成示例，并非对任意用户目录开放的缓存 API。它按已登记字节撤销旧文件、恢复先前原生构建的快照，并拒绝同名用户内容冲突；实际缓存系统还需自行处理并发、符号链接、事务失败和缓存可信性。

可串行执行以下组合回归：

```sh
pnpm --filter weapp-vite build
pnpm verify:edit-sequence --engine weapp-modes --report .tmp/output-mode-sequence.json
```

该观察器使用完整 weapp 插件，覆盖 production→dev→production、dev→production、组件移动/删除、页面及分包迁移/删除、共享依赖变化，以及旧生产缓存恢复。每步完整生产磁盘文件集合及字节与独立进程基线比较，检查 emitted JS 引用和路由文件存在性；`emptyOutDir: false` 额外验证每次切换都保留用户文件。它验证的是模式切换后的产物，不测量编辑 HMR 延迟，也不能替代真实 IDE 页面验收。

### 原生编辑类别与输出范围采样

仓库内的 `scripts/benchmark-templates-hmr.ts` 支持 `TEMPLATES_HMR_PROJECT_ROOT` 指定独立工程。工程中的 `hmr-benchmark.json` 显式列出源文件、目标产物和变更类型；参考 `e2e-apps/github-issues/fixtures/issue-1134-profile`，包含原生 JS、WXML、普通 WXSS、WXSS 导入链、SCSS、Tailwind 内容、局部 JSON、组件引用和页面路由九类编辑。

拓扑编辑只有在目标 JS/JSON/WXML 全部生成后才完成；恢复阶段也须确认这组产物已撤销。classic 刷新当前可达入口，stateful 的入口集合变化会完整重载引擎，不承诺保持旧实例状态。`emptyOutDir: false` 下仅移除当前构建持有且已不可达的文件，保留用户资产。

启用 `TEMPLATES_HMR_OUTPUT_SCOPE=1` 后，报告在计时窗口外记录实际磁盘文件的新增、内容变化、删除及变更后字节数。它不代表底层 write 调用次数，不计相同字节的重复写入；也不能把它直接解释为模块转换成本。使用相同 marker seed 与输入摘要比较样本。完整重载、局部资源更新和脚本补丁分别解释，不混用其延迟或状态保持语义。
