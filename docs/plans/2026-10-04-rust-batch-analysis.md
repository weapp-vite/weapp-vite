# Rust 批量分析与真实链路验证

日期：2026-10-04。实施基线：`e1d0c3131`。本次没有进行全项目 Rust 重写，也没有扩大 native 默认启用范围。

## 已实现的边界

- Rust 批量入口在需要 AST 时对每份源码最多 parse 一次，合并 static require、平台 API、feature flags 与适用的滚动诊断；仅返回摘要，不传递完整 AST。
- `@weapp-vite/ast` 稳定接口与返回形状不变。低层实验 binding 的分析结果增加可选诊断字段；旧 binding 仍可使用独立诊断入口。
- 诊断只复用源码和 filename 一致的已有分析结果；沿用单条缓存，多文件批次只保留末项。不为获取诊断增加一次分析探测，不跨转换阶段复用旧源码结果。
- 显式 Oxc 滚动诊断仍使用 Oxc。native 仍须同时设置两个既有环境变量；加载、解析和执行失败保留 JS 回退。
- Rust 解析错误不再伪装为全 false 的成功结果，JS 可以据此进入回退。

## 观测与基准

`scripts/ast-migration-profile.ts` 现在直接调用生产 `compileVueFile` 和 `transformScript`，移除了手工复刻流程与固定倍率预测。内部观测包括阶段墙钟、根进程 CPU、编译器 Babel 包装入口计数、native 边界调用与输入字节、缓存和回退，以及整批 GC 事件。

未启用观测时不读时钟或计算输入字节；包装函数的调用、分支和闭包仍有成本，不宣称零开销。内部接口没有加入包的公共导出。native 诊断通道连接 source 与 dist 副本，避免从源码订阅却漏掉实际 dist 调用。

阶段墙钟存在嵌套，不能直接相加；CPU 属于整个进程，不能用墙钟减 CPU 推算等待时间。第三方内部 parse 次数仍未知。GC 覆盖整批预热、未观测调用与观测调用，不能归因到单个阶段。

新命令：

```sh
pnpm --filter @weapp-vite/ast-native native:build
pnpm exec turbo run build --filter=weapp-vite...
pnpm profile:compiler
pnpm benchmark:native-analysis --mode=smoke --native-path=packages/ast-native/index.js --output=.codex-tmp/native-smoke
pnpm benchmark:native-analysis --mode=full --native-path=packages/ast-native/index.js --output=.codex-tmp/native-full
```

输出目录必须不存在；正式运行要求干净、已提交的 checkout。具体协议见 [工具说明](../../scripts/benchmarkNativeAnalysis/README.md)。

固定三类模板：原生、Wevu SFC、Tailwind/TDesign。路由和组件拓扑使用已有 `issue-1134-profile` fixture。正式轮数为每模板 7 对构建、每 HMR 场景 20 对，交替开关顺序；目标预先固定为 Tailwind/TDesign 重复构建 wall P50 降低至少 10%。wall/RSS 的 P50/P95 超过 5% 回退时只进行一次等量复核，冲突保留为不稳定。

首次/重复构建均使用新 CLI 进程；后者保留工程输出，不代表进程内暖编译或 OS 冷缓存。HMR 使用既有 120ms polling 协议，计时后执行 GC 与完整产物读取，结果不能直接外推日常默认 watcher 延迟。构建 RSS 是离散进程树峰值；HMR RSS 是 GC 后快照。

配对比较完整产物集合、外置 sourcemap 与 CLI 告警，只规范工作目录和 JSON 键序。输入、源码、dist、驱动、依赖锁文件和 native binding 均保留摘要。计数诊断独立于正式计时；采集错误、中断或清理失败后保存证据并停止后续采样。

off/on 对照包含此前已经存在的 native 加速，不能把所有差异归因于本次新增的滚动诊断。

## 已取得的验证证据

- native debug 与 optimized release：各 99 项正确性测试通过，包含 34 个 built AST + 真实 binding 的 Babel 诊断对齐场景。
- AST：45 项测试、包级 typecheck 与 `test:types` 通过；覆盖缓存隔离、旧 binding、解析失败回退和跨 source/dist 观测。
- compiler：包级 typecheck、实际入口产物/source map/告警等价、观测隔离与 Babel 包装契约通过。
- 下游依赖图重建：28/28 成功。滚动诊断位置修正前，现有 provider-compatible `vite-plugin.runtime.test.ts` 的 native off/on 各 2/2 测试、4 个 DOM 检查点通过，运行时 warning/error/exception 均为 0。该证据不证明最终修正版或真实 Stable IDE 的 runtime 验收。
- website 构建及修改范围 ESLint 通过。Windows/Linux/macOS native CI 已增加，但尚未推送或远程运行。
- profiler/配对基准：9 个测试文件、43 项测试及两套脚本 TypeScript 检查通过；compiler 的 `test:types` 通过。

真实 binding 对照发现原生滚动诊断使用内部调用位置，Babel 则使用回调或对象方法起点；同时修正 UTF-16 列号、换行、同步 API 首见顺序及嵌套独立 hook 等兼容差异。参数化测试覆盖 34 种语法形态，逐项比较告警，并断言联合分析只发生 1 次 binding 调用、1 次缓存命中、0 次 fallback。最终 release 的独立 built-consumer 复核也通过：162 字节源码同时返回依赖、平台 API、feature flags 和两条一致的 `inline.ts:3:14` 告警。

native 对齐修复的 debug/release、包级检查和首次失败复现日志保留在本地 `.codex-tmp/rust-analysis/native-parity-*.log`，最终实际调用结果见 `built-parity.json`。这些日志仅用于本机复核，未将机器绝对路径写入仓库证据。

诊断修正后已再次同步下游依赖图。追加 headless off 验证与另一项目的 E2E 短暂重叠，该次虽退出成功，仍标为 `overlap-excluded`，不计入验收。随后停止启动本任务 E2E，保留其他任务资源并等待；截至记录时另一任务仍占用全局串行资源，最终修正版的 headless off/on 复验尚未完成。原始排除日志为 `post-parity-headless-off-overlap-excluded.log`。

实际编译入口诊断使用固定合成输入，5 次预热、20 次记录；开关两侧代码、source map、告警摘要一致。以下只是诊断数据，不是配对提速证据：

| 入口 | native off 未观测调用 P50 | native on 未观测调用 P50 | 最后一次 Babel parse/traverse/generate 计数 | native 调用 |
| --- | ---: | ---: | --- | ---: |
| transformScript | 0.479 ms | 0.499 ms | 1 / 3 / 1 | 0 |
| compileVueFile | 41.232 ms | 41.039 ms | 974 / 2016 / 73 | 0 |

包装入口计数包含表达式与局部源码处理；974 次 parse 不代表 974 次完整 SFC 解析，也不能推算为 Rust 可一次替代的工作。

这两个 fixture 的 20 次已记录观测调用均未捕获 native 边界事件；native 计数不覆盖预热和未观测调用。native off 时，SFC 的模板、脚本阶段观测墙钟 P50 分别为 16.477 ms、15.214 ms；阶段与根调用的统计分布不同，不作直接求和或 CPU 占比推断。两侧整批分别观测到 73 次 GC、203.942 / 215.318 ms GC entry duration。

首次端到端 smoke 在计时前停止：原生与普通 Wevu 构建没有记录到 native 调用。零调用必须与加载失败区分，不能靠往代表工程中添加人工探针来伪造命中。

源码和依赖核对确认其原因：[emit/generate.ts](../../packages/weapp-vite/src/plugins/core/lifecycle/emit/generate.ts) 仅在 npm 候选、分包 npm 重定位或平台 API 重写需要时启动预分析。前两模板没有适用条件；TDesign 的真实依赖声明 `miniprogram_dist`，触发每次 6 份输入的批次。Wevu 特性收集仍复用自身 Babel/Oxc AST。故前两模板应保留为 `not-exercised` 对照，固定的 TDesign 目标必须实际命中；诊断子进程还必须记录加载失败和回退，避免混淆不同的零调用原因。

## 完整 smoke 的结果与停止条件

第三轮 smoke 完成 28 组采集、200 个计时样本（24 个构建、176 个 HMR），另有 6 次独立诊断构建。没有采集错误；全部告警、Wevu/TDesign 构建产物、三模板及拓扑 HMR 产物一致。原生模板的两份 layout sourcemap 不一致，因此总体为 `incomplete`，正式性能门禁为 `not-run`。

| 固定目标：Tailwind/TDesign 重复构建 | native off | native on |
| --- | ---: | ---: |
| wall P50 | 2398.893 ms | 2189.002 ms |
| wall P95 | 2535.725 ms | 2248.410 ms |

P50 差异为 -8.749%，仅有两对 smoke 样本，不构成稳定提速或达到 10% 门槛的证据。这组采样早于随后修复的 native/Babel 告警位置对齐，不能作为最终 binding 的性能验收结果。正式配对采样未运行，没有根据 smoke 波动启动 5% 回退确认或扩大默认启用范围。

独立诊断完整观察到每个模板的两个构建进程启动及退出。原生与普通 Wevu 为 `not-exercised`，没有加载失败或 fallback；TDesign 自然触发 2 次 batch/binding 调用、12 份输入（含重复）、208962 字节，加载失败和 fallback 均为 0。构建 RSS 的 24 个样本中，21 个采样完整、3 个因进程退出竞争为 partial；有效 RSS 均保留，没有空缺。HMR RSS 是另行记录的 GC 后快照。

采样环境为 Apple M4 Max、16 个逻辑 CPU、128 GiB 内存、Darwin 27.0.0、Node 24.18.0。采样时间为 `2026-10-03T23:30:24.825Z` 至 `23:34:39.161Z`；loadavg 从 `[57.92, 36.97, 29.60]` 变化为 `[15.14, 27.27, 27.54]`，共享机器负载明显变化，不适合据此作稳定收益承诺。

严格产物对照定位到 `layouts/admin/index.js.map` 和 `layouts/default/index.js.map`：第 1 对首次构建、第 2 对重复构建存在差异。原始 map 中 `sources` / `sourcesContent` 的 sidecar 来源分别指向首页与 layout 页面；`mappings` 相同，已解码映射只引用一致的 source 0，JS 产物也相同。但来源清单仍属于 sourcemap 契约，未通过删除或忽略这些字段使门禁转绿。

原生模板没有 native 分析调用，且差异没有固定跟随 native 开关；另外四次最小构建复核的 map 相同。现有证据指向共享 layout sidecar 来源注册的不稳定性，尚未完成独立基线与根因证明，不把它定性为已排除的历史缺陷。本次保留失败证据，不夹带 layout 编译修复。

原始记录保留在本地 `.codex-tmp/rust-analysis/native-smoke-v3/`；修正 smoke 展示语义后的离线报告另存于 `native-smoke-v3-reinterpreted/`，没有覆写原始样本。100 个指标中 96 个配对证据完整，4 个因上述产物差异不完整；完整指标仅标为 diagnostic-only。仓库保存[脱敏摘要](./2026-10-04-rust-batch-analysis-evidence.json)，包含原始报告 SHA-256、差异清单及完整性计数。更早两轮分别暴露 native 零调用分类与暂存工作区依赖链接缺失，修复后才取得本轮完整采集。

当前结果支持保留可选 POC、继续修正正确性与测量边界，不支持整链 2 倍提速承诺。

## 环境与未完成验收

官方渠道查询时间为 `2026-10-03T22:40:19Z`，来源为 [微信开发者工具版本配置](https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json)。查询结果的最新 Stable 为 `2.02.2608080`，发布日期 2026-09-30。

Computer Use 读取的现有用户宿主为 `2.02.2609231 RC`，基础库 `3.16.2`，正在使用其他项目。本任务没有接管或关闭该宿主，也没有将 RC 当作 Stable。当前未配置可用的最新 Stable 验收入口；真实 Stable runtime、真机和跨操作系统结果均未通过验证。

本机 release 绑定可加载且测试通过；隔离 Rust 工具链的 strip 阶段出现非致命 LLVM 动态库路径警告。没有安装或修改全局工具链。隔离 minimal 工具链未提供 rustfmt，因此未声称 rustfmt 检查通过。

## 维护取舍

新的 profiler 与配对基准按职责拆分为小模块。既有 `lib.rs` 超过 300 行，本次维持 visitor 边界，只抽出共享诊断收集，不夹带大规模文件重组。既有 HMR runner 也较长，本次仅添加默认关闭的证据钩子和对应清理错误传播，新驱动放在独立目录。

下一步扩展应以端到端结果和实际热点为依据；目前继续保持 native 显式启用及完整 fallback。

## 后续实验：WXML 依赖扫描

本轮尝试用一次 Rust 扫描返回 WXML 依赖摘要，避免把完整 AST 搬回 JS。该原型没有进入生产路径，也没有增加 WXML native 公开接口或新的 Web 包依赖。

局部扫描有明显的输入敏感性。20 次预热、100 次记录的顺序采样中，64 字节输入的 JS/native P50 分别为 0.004791/0.001 ms；6,497 字节、200 条依赖的输入为 0.065792/0.074 ms，native 更慢；35,529 字节、201 条依赖且含 1,000 个普通 view 的输入为 0.535833/0.2225 ms。这些数据来自标签提取 micro benchmark，没有交替配对，不是编译器或端到端提速证据。

451 份实际模板的标签提取曾与简化 DOM 遍历一致，但这个对照没有覆盖生产 `collectSpecialNodes` 的语义。审查生产入口后找到以下确定差异：

- 丢失不支持组件与重复 WXS module 告警。
- 按源码顺序返回依赖，而生产路径按 import、include、external WXS 分组。
- 未跳过 import/include/WXS 的子树，误收集内嵌依赖。
- 不支持 `wx-include` 等别名，错误处理无 module 的 WXS 和空 src。
- resolver 抛错时保留已经提交的部分依赖，破坏原有收集失败的原子性。

因此撤回 native 接入。后续若继续，应返回包含必要告警事件的粗粒度摘要，并与真实 `compileWxml` 的依赖、告警、回调顺序及失败语义逐项差分，再验证端到端收益；不能用标签提取一致替代生产语义一致。

本轮保留一个由热点分析发现的 JS 改进：递归依赖扫描仍复用 parser 与 `collectSpecialNodes`，但跳过不会使用的 renderer/codegen；根模板仍在成功生成代码后展开依赖。新增测试覆盖仅渲染根模板、告警与分组依赖顺序、子树跳过、resolver 失败原子性和根渲染失败前不展开依赖。此改动可能消除原来由无用代码生成引发的资源异常，例如极深依赖模板的 renderer 栈溢出；不宣称所有资源失败完全等价。

200 个 include 的编译器入口合成实验使用 8 次预热、30 次配对采样：旧实现 P50/P95 为 5.400/6.863 ms，跳过重复 codegen 后为 4.515/5.830 ms，分别降低 16.38%/15.06%。此前一次运行的 P50/P95 降幅为 14.19%/1.77%，尾延迟仍受环境影响。这是依赖密集的局部编译入口诊断，没有证明代表工程的构建或 HMR 达到正式门槛。

## CI 暴露的观测模块边界

PR 的原生正确性检查已在 macOS、Linux、Windows 通过。Web E2E 则在 SFC playground 发现 `AsyncLocalStorage is not a constructor`：常规编译入口导入观测模块时，顶层初始化了 Node 专用 API，进入浏览器 bundle 后启动失败。

修复将编译器常规路径收敛为无 Node 依赖的可选观测门面；独立 Node 入口持有 AsyncLocalStorage、时钟与进程 CPU 采集，并在显式观测期间安装适配器。保留并发隔离、嵌套阶段和未启用时的直接执行语义。新增无 Node API 的导入回归，并保留真实 browser bundle 的既有 E2E 验证；最终 CI 结果以 PR 最新提交的检查为准。

## 后续实验：作用域感知的产物改写摘要

前述 native 预分析只返回布尔值。命中 require 或平台 API 后，产物改写仍需 Babel 再次 parse/traverse。本轮新增默认关闭的 Cargo feature `experimental-chunk-analysis`：一次批量 N-API 调用，在每份源码的一次 Oxc parse 与作用域分析后返回静态 require 首参和未遮蔽平台对象的 UTF-16 区间，不返回 AST，也不逐节点回调 JS。

实验 JS 适配器直接复用现有 npm 路径规范化、平台别名生成和 sourcemap 组合。为保留严格 map 契约，继续执行原有两阶段 MagicString 编辑，只将第二阶段区间按第一次编辑的长度变化平移。该模块没有接入生产 JS 导出、用户配置或热路径；Oxc semantic 为可选 Cargo 依赖，普通构建不包含它。

已完成以下正确性验证：

- debug/release 绑定各通过 32 项差分与边界测试，覆盖词法作用域、提前声明、可选链、计算属性、括号、Unicode 标识符、UTF-16 偏移与整个批次失败。
- JS 适配器 10 项测试通过，覆盖原始代码/maps 一致、单次批量调用、无效结果原子回退，以及无法无损转成 UTF-8 的孤立代理字符。
- 26 个语义样本的外置/内联 map 共 52 项检查通过；新构建的 TDesign 工程 415 份 JS、873,624 字节，共 830 项检查通过，均没有 fallback。命中计数按原始语料记录，不因两种 map 模式重复累计；415 份输入中，218 份进入 native，197 份沿用生产文本预筛选跳过。该语料有 405 份 JS 位于复制的 npm 资源目录，不能用它代表真实 chunk 工作量。
- 这些 map 是为每份已构建 JS 新建的 identity map，用来严格对照两阶段映射组合。没有读取工程原来的 map，不能将此结果写成原工程的 sourcemap 端到端验收。
- 已添加三操作系统的独立 feature 构建与正确性步骤；提交 `5e880d3c5` 的 macOS/Linux/Windows 矩阵均已通过（Native AST Analysis run `37188974109`）。

等待同机 E2E 退出后，使用 release 绑定完成 8 对预热与 30 对交替顺序采样。首次全目录语料的 JS/native P50 为 144.703/18.767 ms，但这包含复制资源，仅保留作大语料重放证据。

随后通过 Node 内存加载钩子，在真实 `resolveDevHmrRewriteBundle` 之后、任何改写之前捕获 `type === 'chunk'` 输入。实际只有 10 个 chunk、105,592 字节，其中 6 个进入 native、4 个被文本预筛选跳过；捕获时另有 21 个 asset 被排除。外置/内联 map 的 20 项检查全部通过，无 fallback；摘要有 9 个 require 字面量，没有平台 API 对象。

| 实际 chunk 语料的局部重放 | JS | Rust |
| --- | ---: | ---: |
| P50 | 8.340 ms | 1.203 ms |
| P95 | 11.136 ms | 1.259 ms |

P50 的绝对差约 7.14 ms。这是 macOS arm64、Node 24.18.0 共享机器上的单轮实验，采样前后未见活动 E2E/性能任务，但仍有 IDE 等系统负载。捕获工程原配置是 `weapp`、Babel、未启用 `injectWeapi`；重放固定调用支付宝 npm 规范化与 `wpi` API 改写，因此不能称作该模板自然改写阶段或整构建的提速。也没有迁移 local npm root 的互操作传播逻辑。

结论是该粗粒度摘要有局部净收益，但当前自然工作量较小，尚未证明整构建达到 10% 门槛。继续保留为默认关闭的实验；扩大生产覆盖仍须代表工程构建/HMR、RSS、原始产物/maps/告警与跨平台验证。

可复现命令及测量边界见 [实验工具](../../scripts/nativeChunkAnalysis/README.md)，本轮 [脱敏证据摘要](./2026-10-04-rust-chunk-analysis-evidence.json) 保留输入规模、原始报告摘要和完整性结果。

## 真实模板入口的重复解析归因

通过 `scripts/astMigrationProfile/attribution.ts` 的 count-only 观测适配器，在同一 SFC fixture 上预热 5 次后观察 1 次真实 `compileVueFile`。实际计数确认 974 次 Babel parse、2016 次 traverse、73 次 generate：

| parse 调用来源 | 次数 |
| --- | ---: |
| 绑定表达式的 manifest 依赖分析 | 266 |
| 同一 manifest 分析中递归解析外层循环列表 | 458 |
| runtime fallback 判断 | 170 |
| JS 表达式规范化 | 49 |
| 内联事件表达式 | 24 |
| 脚本与宏 | 7 |

模板阶段合计 967 次 parse，manifest 路径占 724 次。这是调用次数归因，不是耗时占比；采集调用栈本身较昂贵，工具刻意不计时。重复循环来源的去重机会值得先验证 JS 缓存边界，再评估整模板 Rust 批量分析。最终结果依赖作用域、for/slot 别名与 safe-call 配置，不能只按表达式字符串缓存完整结果；scoped slot 当前在遍历过程中立即消费子 manifest，批处理必须先处理这个生命周期边界。

## 模板表达式批量 Rust 实验

新增默认关闭的 `experimental-binding-analysis` Cargo feature，不导出到生产 JS，也不替换现有 compiler。Rust 一次接收一批 normalized 表达式、locals、safe-call 配置与 JS 提供的全局名称集合，返回有序依赖路径和 snapshot fallback 事实。JS 保留循环、slot、JSX scope 合并以及 manifest 生成。

诊断工具通过 Node 内存加载钩子，在真实 `collectDependencies` 中完成 normalization 后捕获请求，并在循环依赖合并前保存 Babel oracle。源码和 dist 不改变，捕获不计时。重放复用相同生产分析主体，只在进程内绕过已经完成的 normalization，以确保 JS 与 Rust 的测量边界一致。压力 fixture 的输入和最终编译结果 hash 与原归因运行一致。

| 语料 | 原始请求 | 不同表达式 | 不同完整请求 | release 差分失败/回退 |
| --- | ---: | ---: | ---: | ---: |
| 原 SFC 压力 fixture | 724 | 148 | 197 | 0 / 0 |
| 零售模板商品详情页 | 64 | 53 | 53 | 0 / 0 |
| Wevu 示例首页 | 34 | 19 | 19 | 0 / 0 |

两个真实页面使用工具固定的 `compileVueFile` 页面选项，报告记录具体选项；不是读取原工程全部 Vite 配置的完整构建。每项严格比较捕获 oracle、JS 重放、JS 去重和 Rust；不同实现任一不一致或 native 发生回退时，禁止计时。

debug/release 绑定各通过 82 项语义与边界测试，适配器 8 项测试、TypeScript 和 ESLint 检查通过。覆盖内部词法绑定、静态与动态成员、JS 数字路径格式、调用/可选调用、解构赋值、有限 TypeScript 去除及保留的类型节点行为。原始 UTF-16 和字面量中的孤立代理项显式拒绝，不做有损转换。默认绑定没有新增实验导出。

性能工具同时保留原始 JS、按完整请求去重的 JS、按相同键去重后一次调用的 Rust。缓存限于当前批次；六轮预热后轮转三实现的六种执行顺序，计时包括去重、NAPI、结果验证与恢复顺序。本轮 release 正确性完成时，同机另一个任务已开始 E2E 预检，因此尚未采样。不能把 724→197 的重复工作减少直接归因于 Rust。

生产接入仍有生命周期前提：scoped-slot 子脚本在模板遍历期间立即消费 manifest，之后还有 owner 依赖保留、位置重映射和 layout 追加绑定。当前离线批处理未解决这些边界，不宜直接延迟所有分析至模板结束。三操作系统 CI 已增加 feature 构建、真实捕获与无计时重放，本轮远程结果等待提交后验证。

复现步骤见 [表达式实验工具](../../scripts/nativeBindingAnalysis/README.md)，可审阅的计数和报告 hash 见 [证据摘要](./2026-10-04-rust-binding-analysis-evidence.json)。

## 第九轮：binding 表达式三实现配对采样

确认其他任务的 E2E/dev-watch 进程退出后，串行重放三组已捕获请求。每组先预热 6 轮，再采样 30 对，轮换原始 JS、按完整请求去重的 JS、按同一键去重的一次 Rust 批量调用的全部 6 种顺序。计时包含去重、NAPI 输入输出、结果验证与顺序恢复，每批重新创建缓存；822 个请求继续全部对齐捕获 oracle，零回退。

| 语料 | 请求 / 唯一请求 | JS P50 / P95（ms） | JS 去重 P50 / P95（ms） | Rust P50 / P95（ms） | 相对去重 JS 的 P50 绝对差 |
| --- | --- | --- | --- | --- | --- |
| 压力模板 | 724 / 197 | 8.887 / 16.517 | 2.768 / 7.100 | 0.673 / 1.030 | 2.095 ms |
| 零售商品详情 | 64 / 53 | 0.996 / 3.235 | 0.853 / 1.198 | 0.160 / 0.218 | 0.693 ms |
| Wevu 首页 | 34 / 19 | 0.603 / 1.120 | 0.387 / 3.240 | 0.075 / 0.131 | 0.312 ms |

在这次局部重放中，Rust 相对去重 JS 的 P50 仍减少约 75.7%、81.2%、80.7%。压力模板中，仅 JS 去重就将 8.887 ms 降到 2.768 ms，因此不能把全部差值归因于 Rust。进一步按规范化表达式缓存不变语法摘要可能把压力模板的解析次数从 197 降到 148；这一更强 JS 基线尚未实现。

本轮只有一次共享机器采样，16 个逻辑 CPU 下的 1 分钟 loadavg 为 27.1–35.0，JS 尾延迟波动明显。结果只支持继续验证该计算边界，不证明稳定倍率、整链达到 10% 门槛、RSS 降低或运行时改善。原始 90 对样本、环境、捕获/源码/二进制 hash 保存在 `2026-10-04-rust-binding-analysis-evidence.json`。

提交 `f26ac58c1` 的 Native AST Analysis（run `37190452333`）在 macOS/Linux/Windows 全部通过，包括新增的 binding feature。默认导出和生产编译调用路径仍未启用这两个实验 API。

## 第十轮：修复整链产物对照的 layout 归属问题

原生模板的 layout sourcemap 差异已用最小测试复现。父页面通过 `prepareNormalizedEntries()` 登记共享 child 时，尚未加载的 child 临时记录携带父页面 path、JSON、模板和组件声明；production logical wrapper 在物理 child 加载前读取该记录，导致父页登记顺序决定侧车来源。4 个初始用例中，两种父登记顺序和 child 无侧车场景失败，已加载 child 场景通过。

修复限定在逻辑入口的读取边界：用源码规范化身份确认 entry.path 属于 owner，相对 key 是父占位时继续查绝对 key；未加载 owner 时按现有 JSON service / Vue 配置优先级读取自己的声明。Vue 配置沿用 compilerContext、源码快照和 autoRoutes 选择规则，并登记配置源 watch。此处不写回注册表，也不递归完整 loadEntry，避免重新引入发射与自动导入生命周期。

验证覆盖父顺序、缺失侧车、已加载 child、读取期间完成 child 加载、自有 usingComponents/componentGenerics、绝对 key、JSON/JSON.ts 优先级、Vue 快照和 autoRoutes。新增 13 项、现有 logical entry 8 项及邻近入口/layout 126 项测试通过；包级 typecheck、build、test:types 通过。

重建 weapp-vite 后，用原生模板的真实 Vite/Rolldown 输出串行验证 4 次独立构建，native 顺序为 off→on→on→off。每次 38 个文件、9 份 map、告警完全一致；admin/default layout 的 sources 均包含自身 JSON/WXML，不再包含父 pages 文件。保留原 map 全部字段，仅规范工作目录和 JSON 键序；未删 sources/sourceContent，也不是 identity map 重放。第一次检查脚本错把虚拟 sidecar 的 `:module.js` 后缀当作物理扩展名，修正检查后重新运行到新目录，旧失败记录保留。摘要和完整文件 hash 见 `2026-10-04-rust-sidecar-ownership-evidence.json`。

此轮只验证静态输出正确性，不作性能结论。原生模板历史上没有适用 native 调用，开关两侧一致也不等于 Rust 热路径覆盖。另一任务重新启动了 DevTools E2E，完整 build/HMR 配对门禁仍未重跑；此前的历史 incomplete 报告保留。此次源码行为修复添加 weapp-vite 与 create-weapp-vite 的中文 patch changeset。
