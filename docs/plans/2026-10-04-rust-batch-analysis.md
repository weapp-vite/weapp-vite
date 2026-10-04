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

## 第十一轮：语法摘要缓存与五实现对照

Rust 实验现在在每次 NAPI 调用内，按精确表达式缓存自有数据摘要，再按 locals、safe-call 和当前 globals 特化。压力语料的唯一完整请求有 197 项，但只有 148 个表达式，因此减少 49 次解析；两个较小语料的表达式数与唯一请求数相同，缓存没有额外解析可省。摘要不保留 Oxc AST/allocator，返回或异常时释放整批缓存；缓存命中仍逐项校验 UTF-16，解析失败的 null 和空依赖结果保持区分。

新增 JS 摘要缓存对照直接使用生产 visitor，以诊断观察器记录直接调用名，不复制 Babel 分析逻辑。五路对照为原始 JS、完整请求缓存 JS、语法摘要缓存 JS、旧 Rust、新 Rust，全部按相同请求恢复结果。822 条真实请求全部对齐捕获 oracle，零回退。debug/release 各 91 项绑定测试、3 项实际 parse 计数及缓存边界 Rust 测试、16 项脚本测试通过；TypeScript 检查通过，默认绑定未包含实验 API。原始可选调用与 WXML normalization 后的普通调用分别测试，避免把降级后的 safe-call 语义误判为 Rust 差异。

采样前后未发现活动仓库 E2E、构建或性能任务，三份语料串行执行；每组 6 轮预热和 40 轮采样，五实现的执行位置及轮内前序在 10 轮周期内平衡，每批缓存重置。共享机器 16 个逻辑 CPU，1 分钟 loadavg 为 21.1–22.0，仍存在系统负载。

| 语料 | 原始 JS P50 / P95（ms） | 完整请求缓存 JS | 摘要缓存 JS | 旧 Rust | 新 Rust |
| --- | --- | --- | --- | --- | --- |
| 压力模板 | 8.542 / 15.053 | 2.734 / 6.278 | 2.332 / 5.460 | 0.658 / 0.775 | 0.651 / 0.728 |
| 零售详情 | 0.936 / 2.551 | 0.766 / 1.605 | 0.840 / 1.660 | 0.171 / 0.213 | 0.178 / 0.222 |
| Wevu 首页 | 0.539 / 3.284 | 0.341 / 0.553 | 0.371 / 0.628 | 0.080 / 0.113 | 0.091 / 0.143 |

这次局部重放中，JS 摘要缓存只在压力语料改善 P50（约 14.7%），另外两组增加约 9.7% 和 8.9%。新 Rust 相对旧 Rust 的 P50 仅在压力语料下降约 1.0%（0.0067 ms），另外两组增加约 4.3%（0.0073 ms）和 14.5%（0.0115 ms）。减少 parse 次数没有转化成明确的 Rust 净收益，额外摘要收集、缓存和特化有成本。保留此实现用于后续默认关闭的实验，不作为生产优化推广；单轮结果也不足以判定稳定回退。完整编译、构建/HMR、RSS 和运行时收益均未由此次局部测量证明。完整 120 轮样本、双绑定 hash 与边界记录见 [摘要缓存证据](./2026-10-04-rust-binding-summary-evidence.json)。

完整 build/HMR smoke v4 在启动前确认互斥，但运行期间另一任务启动 DevTools E2E，随后仅终止本任务 collector。报告保留为 incomplete（13 个 run、64 个 sample、Collector interrupted），相关耗时不用于验收。诊断构建中原生和 Wevu 模板各 0 次 native 调用，TDesign 为 2 次 batch 调用、12 份脚本、208,962 字节、零回退；不能把无命中场景的开关差值归因于 Rust。

固定提交 `a822fb7ff5eeb341a6b95bafa4f9eaef24fbd412` 的 [独立三平台正式性能运行](https://github.com/weapp-vite/weapp-vite/actions/runs/37192496301) 已派发，记录时仍在排队。它测量已接入生产的 native 路径，不包含本轮默认关闭的 binding 摘要实验；端到端 10% 收益及不超过 5% 稳定回退的门槛仍未证明。

## 第十二轮：批内 arena 复用与真实编译 CPU 采样

利用上一轮摘要只持有自有字符串/数组的边界，在每次 NAPI 调用内复用一个 Oxc allocator，每个唯一表达式解析返回后立即 reset，再缓存结果或传播错误。此前每个表达式都新建 arena，这属于摊销原有分配成本，不是修复摘要缓存新引入的成本。Oxc 只保留最大的内存块到本次调用结束，不跨批次池化，未据此承诺 RSS 下降。

4 项 Rust 契约测试通过，新增大表达式→小表达式→解析失败→旧摘要命中覆盖，确认实际 parse/reset 次数和 reset 后用量归零。debug/release 各 91 项真实绑定测试通过，三组共 822 个真实请求五路结果一致、零回退。生产导出、配置及编译热路径保持原有边界。

第一轮局部采样启动后，另一个任务开始单测，因此完整排除该轮，后续语料和 CPU 采样没有启动。待其退出后，在新目录串行采样；第二轮各步骤前后进程检查为空。每份语料 6 轮预热、40 轮五实现平衡采样，旧 Rust 明确指上一轮的摘要缓存版本，两个 release 二进制分别保留 hash。

| 语料 | 原始 JS P50 / P95（ms） | 请求缓存 JS | 摘要缓存 JS | 原摘要 Rust | arena 复用 Rust |
| --- | --- | --- | --- | --- | --- |
| 压力模板 | 8.934 / 16.416 | 2.737 / 7.341 | 2.374 / 4.601 | 0.648 / 0.722 | 0.658 / 0.919 |
| 零售详情 | 0.858 / 1.285 | 0.762 / 1.184 | 0.825 / 3.660 | 0.184 / 0.226 | 0.183 / 0.269 |
| Wevu 首页 | 0.518 / 2.848 | 0.325 / 0.762 | 0.352 / 0.612 | 0.085 / 0.130 | 0.089 / 0.162 |

arena 版本 P50 分别变化约 +1.48%、−0.95%、+4.54%，没有明确净收益，P95 也没有改善。保留为默认关闭的实验，不扩大生产覆盖。一次共享机器局部采样不足以证明稳定回退或提升；这里的微小差值不支持继续围绕 allocator 微调来承诺整链收益。

为避免把大量 parse 次数误认为最大 CPU 热点，增加 [V8 主线程采样工具](../../scripts/astMigrationProfile/README.md)。每份语料预热 5 次后采样 60 次真实 `compileVueFile`，不启用阶段观测或源码加载钩子；1 ms 间隔，分别得到 2,471、1,529、635 个样本。最后一次编译的完整返回值、maps 和告警与预热结果一致。15 项摘要归因测试、2 项既有 GC 测试、脚本类型检查通过，另用一次真实入口 smoke 核对 Inspector、哈希、脱敏和样本总数；该 smoke 不用于热点结论。

| 语料 | Babel traverse self | Babel parser self | Babel generator self | GC | 脚本模块 inclusive | 模板模块 inclusive | binding manifest 模块 inclusive |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 压力模板 | 30.7% | 11.7% | 13.5% | 9.2% | 37.0% | 36.8% | 22.8% |
| 零售详情 | 39.0% | 17.5% | 5.7% | 10.5% | 50.0% | 15.4% | 4.8% |
| Wevu 首页 | 29.9% | 16.2% | 6.8% | 8.5% | 47.4% | 19.4% | 7.1% |

以上均为 V8 主线程样本占比；GC/idle/unattributed 保留在分母中，inclusive 行相互重叠，不可相加，也不是进程总 CPU 时间。系统 1 分钟 loadavg 约为 16.8–17.2，仍有系统负载。这里的 script.ts 模块还包含模板前 props 分析，不等同单个阶段。按 compileScriptPhase 函数栈统计，三组分别为 34.52%、42.45%、39.37%；模板前 resolveEffectivePropsDerivedKeys 分别为 2.51%、7.52%、7.72%，其内部函数不可再相加。两个真实页面的脚本相关样本多于模板，而 manifest 在压力 fixture 更突出：下一步优先调查脚本的重复遍历、宏转换与生成边界。若继续验证 manifest Rust 接入，应在每个 manifest 完成时批处理，分别在 scoped-slot script 生成前和根 owner-binding 保留前 flush，保留同步消费和有序 binding ID；不能用计时外预填结果替代真实完整编译。

可审阅的完整配对样本、CPU 摘要、原 profile hash、环境和排除记录见 [本轮证据](./2026-10-04-rust-arena-cpu-evidence.json)。原始 `.cpuprofile` 只保留在本地，三平台 CI 只上传脱敏摘要。

正式性能 run `37192496301` 的 Linux/macOS 已进入固定配对采集；Windows 全部 native 与脚本正确性检查通过，但在首个诊断构建写 npm 缓存时遭遇 `ENOTDIR`，尚无配对性能样本。检查点位于隔离工程的 `node_modules/weapp-vite/.cache` 目录创建，当前调查 junction 和文件系统路径边界，尚未证明属于 Rust 回归，也未修改性能阈值。阶段测试新增对隔离目录依赖链接下缓存写入的回归，远程复核结果待更新。

新增真实隔离工程诊断入口，在 prepare 前分别记录源工程、暂存工程和仓库直接依赖路径的 lstat/stat/readlink/realpath/package.json；不能用可向祖先回退的模块解析替代直接路径检查。macOS 实际 prepare、首次/重复构建及清理通过，两次均为 38 个文件、9 份 map，产物相同且无告警；native 观测有效但该模板没有调用命中。此时其他项目有测试运行，因此这些构建只作正确性验证，不使用耗时。归因及 benchmark 脚本共 65 项测试、两组脚本类型检查与定向 lint 通过。Windows 复核仍待新提交 CI，未宣称 ENOTDIR 根因修复。

## 第十三轮：完整编译中的 manifest 批处理与 Windows 暂存修复

本轮把 binding 实验放回真实 `compileVueFile` 调用。诊断进程在遍历时冻结已规范化表达式、循环外层依赖、locals、safe-call、scope 及源码位置；每个 scoped-slot 子清单在脚本生成前 flush，根清单在 owner-binding 保留前 flush。直接 owner 绑定进入同一有序队列，保留 binding ID；JSX/layout 后续合成绑定仍用同步 JS。生产源码、公开 API 和默认 native 开关均未修改。

五个独立进程分别运行原始编译器、相同 strip loader 的原逻辑控制组、完整请求缓存 JS、语法摘要缓存 JS 和批量 Rust。控制组对相同三文件使用同样的加载/转译方式，但不增加全局对象、collector 导出或队列。它将加载器差异与批处理收益分开；Rust 的附加收益还须与相同计划上的两种 JS 缓存比较。计时只包含完整编译，含本次规范化、计划、分析与清单消费；IPC、结果序列化和严格对照在窗口外。计划与批缓存每次重建，生产编译缓存经过预热，不把它称为冷编译或完整 Vite 构建。

五路通过全部 13 个场景，每次严格对比完整返回值、sourcemap、告警和预期错误。三个代表语料及主要边界的 native 计数如下：

| 语料 | 请求 / 唯一请求 | NAPI 调用 | 关键覆盖 |
| --- | ---: | ---: | --- |
| 压力模板 | 724 / 197 | 1 | 266 条绑定 |
| Wevu 首页 | 34 / 19 | 1 | 16 条绑定 |
| 零售详情 | 64 / 53 | 1 | 52 条绑定 |
| scoped slot | 19 / 14 | 2 | 根/子清单分别消费，1 条直接 owner 绑定 |
| JSX | 0 / 0 | 0 | 4 次同步 JS 分析 |

额外覆盖嵌套循环、事件与重复表达式、slot outlet、Unicode/CRLF、静态模板、native 抛错、返回长度错误和无效模板。两个注入故障各发生一次整批 JS fallback，结果仍与原编译器完全一致；其余正常场景零 fallback。所有场景结束后均无 pending 工作或 active template，进程清理错误为零。批处理/加载器/进程生命周期及既有相关工具共 38 项测试、两组脚本类型检查和定向 ESLint 通过；生命周期测试确认发送错误不等同子进程退出，且清理不影响另一个进程。

性能证据尚不足。第一轮四路完整编译采样因进程监控错误地排除了祖先进程的其他子任务，全部耗时作废。第二轮修正监控后只完成压力样本；零售样本与其他 E2E 重叠，排除后停止。两轮均缺少相同 loader 控制组，因此不得把原始编译器到批处理版本的差值归因 Rust。补齐第五组后，采样前仍检测到其他任务，未启动新计时。后续按 10 轮预热、每组 40 轮平衡顺序，串行重复三份语料两批；RSS 只记录编译后 worker 快照，不能解释为峰值或进程树 RSS。原始排除记录和最新正确性证据见 [完整编译实验记录](./2026-10-04-rust-complete-compiler-evidence.json)。

Windows run `37195472616` 的诊断表明，源工程和仓库直接依赖均能解析，但暂存工程的相对 pnpm 链接在外层 junction 下 `stat`、`realpath` 和直接 `package.json` 全部返回 `ENOENT`。此前测试在 Windows 内层也使用绝对 junction，未覆盖实际相对 symlink。修复仅落在 benchmark 暂存工具：Windows 使用真实 `node_modules`/scope 目录，每个依赖链接到已解析的绝对目标，保留 `.pnpm` 的绝对 junction；普通元数据文件复制，源目录只读。暂存完成时先核对直接 package 路径，再检查模块解析，避免祖先回退掩盖断链。

回归测试在所有平台创建实际相对 symlink，并在 macOS 上额外执行 Windows 布局策略，覆盖 scope、首次/重复缓存写入、HMR 的额外 junction、相对插件路径、缺失直接依赖和清理后的源目录完整性。修复后本地实际 staged prepare、两次构建和清理通过，均为 38 文件/9 份 map、零告警；原生模板仍无 native 命中。真实 Windows 复核等待该修改的 CI；已有固定提交正式性能运行保持原目标，不因这次修复重新派发。整链 10% 收益门槛、跨平台结果和真实 Stable DevTools runtime 最终验收仍未完成。

## 第十四轮：三平台正确性与独立完整编译采集

提交 `977178c792487942dee181d83e3995d77c00224a` 的 [三平台 native correctness](https://github.com/weapp-vite/weapp-vite/actions/runs/37198027593) 已全部通过。各平台的五路完整编译对照均覆盖 13 个场景。Windows 暂存修复在实际 runner 通过：源工程、隔离工程和仓库直接依赖均能解析到同一包，prepare、首次/重复构建及清理成功，两次均为 38 个文件、9 份 map、零告警；该原生模板没有 native 命中，不从此次修复推导 Rust 性能收益。对应产物及 hash 已补入 [完整编译证据](./2026-10-04-rust-complete-compiler-evidence.json)。

本机预检再次发现其他项目的活动 E2E、构建和 dev 服务，未启动新性能样本。新增串行采集入口 `compileTimings.ts`：先运行全部正确性场景，再执行两批三份语料，每组 10 轮预热、40 轮五实现平衡采样。聚合时拒绝失败、缺样、执行顺序不完整、来源身份漂移或产物不一致的报告；每个批次单独保留 P50/P95 和逐对差值，不混池。手动 CI 使用独立 concurrency group，已有固定提交正式性能运行不受影响。共享 runner 仍可能存在资源争用，采集结果不直接判定生产构建/HMR 的 10%/5% 门槛。 新增 15 项聚合/串行失败契约测试，binding 脚本当前 9 文件共 43 项测试通过，局部类型和 ESLint 检查通过；另用刚下载的三平台真实报告核对来源 schema。

同时核对了下一处脚本边界。`compileVueFile/index.ts` 的 props 分析通过 `getCompiledScriptAst` 解析编译后脚本，最终 `transformScript` 又对相同源码解析；既有“一次解析”测试只 spy `parseJsLike`，未统计最终转换的 parser wrapper。可以验证同次编译内的 AST 所有权移交，但最终源码必须逐字相同；JSON 宏剥离、补默认导出或 JSX/island 转换改变源码时必须重新解析，不能跨编译缓存已改写 AST，也不能为复用强制触发原本可跳过的 parse。

另有三个值得先验证的 JS 基线：props-return visitor 不查询 scope，可尝试 `noScope`；page-meta 在已存在 AST 上固定遍历两次，可用现有 `mayContainPageMeta` 作保守负向检查；reserved-props 对没有 `defineProps` 的 setup 也会解析和遍历，可增加保留反斜杠兜底的负向检查。这些只是源码审计得出的候选，本轮未实施，也未把理论节省写成实测收益。

page-meta/props 查询已经使用 Babel AST，拆成单独 native API 会增加 Oxc parse，却保留最终 JS 改写与生成。下一项完整阶段 Rust POC 应在优化 JS 后重新归因，再决定是否迁移整个 `transformScript`：一次输入最终源码、可序列化模板元数据与选项，返回 code/map/能力/告警；Babel `expAst` 转成自有数据的成本也必须计入，失败只能整阶段回退。继续遵守粗粒度边界，不根据局部倍率扩大生产覆盖。

## 第十五轮：三平台完整编译采样与更强 JS 基线

提交 `717348860e0305a0467b127336fbe23be7b44e97` 的[独立完整编译运行](https://github.com/weapp-vite/weapp-vite/actions/runs/37199077258)在 Linux、Windows、macOS 全部成功。每个平台先通过 13 场景五路正确性，再串行执行压力模板、零售详情和 Wevu 首页各两批；每组预热 10 轮、采样 40 轮，五实现按平衡顺序运行。21 份原始报告 SHA 核验通过，聚合重算一致；另独立重算 972 个分位数和 4320 条配对记录。720 次计时 native 调用零 fallback、零清理错误；正确性故障注入每平台各两次 fallback 单独记录。

压力模板中，native 相对相同 loader 原逻辑控制组的配对 P50 耗时减少 23.42%–28.54%，相对相同计划的 JS 摘要缓存减少 9.32%–18.65%。真实页面的 Rust 附加收益小得多，甚至变号：

| 平台 | 零售详情第一 / 第二批 | Wevu 首页第一 / 第二批 |
| --- | --- | --- |
| Linux | 1.05% / 1.25% | 5.32% / 2.69% |
| Windows | 3.60% / 2.78% | −0.71% / −3.35% |
| macOS | 5.89% / −3.79% | 3.90% / 2.67% |

表中为 JS 摘要缓存→native 的逐对耗时节省百分比 P50，负值表示 native 更慢；不是分别取 P50 后相减，也未混合语料或批次。坏尾延迟同样没有一致改善：Linux 零售第二批 native wall P95 比摘要 JS 高 13.28%，Windows 零售第二批高 5.65%。Windows 零售第一批及 macOS 压力第一批的 native RSS P50 分别高 12.68%、10.90%。RSS 仅是编译后 worker 快照，不能解释为峰值或进程树内存；收益分位数的 P95 也不能替代 wall latency P95。

这些是温热缓存下完整 `compileVueFile` 的诊断结果，不是冷构建、Vite/HMR 或小程序运行时。macOS runner 为 Node 24.20/arm64/3 CPU，Linux/Windows 为 Node 24.21/x64/4 CPU，且 macOS 有较高 loadavg；不能直接比较不同 OS 的绝对耗时，Windows loadavg 为零也不证明空闲。生产固定 off/on 性能门禁在此 run 中未启用。完整聚合、配对样本、身份和限制见[三平台采样证据](./2026-10-04-rust-compiler-timing-evidence.json)。结果支持继续调查计算边界，不支持扩大生产覆盖或默认启用。

同时新增[脚本 JS 基线工具](../../scripts/scriptAnalysisBaseline/README.md)，仅通过诊断 source loader 实施四项独立实验：同次编译的 AST 单次所有权移交、props-return visitor 的 `noScope`、page-meta 和 reserved-props 保守负向检查。AST 只在已有值、最终源码逐字相同、fast path 未命中时复用；源码变化仍重新 parse，异常和未消费 token 在 finally 释放。没有生产源码改动，也没有新增 NAPI 调用。

原始编译器、相同 loader 控制组、四项单独优化及组合版，七个独立进程各执行 32 场景两次，共 448 次编译检查通过。重复调用也与首次原始结果比较，完整保留输出、map、告警和公开错误诊断字段；每次实际源码/配置输入摘要与父进程一致。覆盖 AST 复用/源码变化/不可用、两类 guard 的正负分支、宏转义/别名/类型与值遮蔽、TSX、Unicode/CRLF 和失败清理。17 项单测、脚本 typecheck 和定向 ESLint 通过，已接入三平台 correctness CI；当前本地记录见[JS 基线证据](./2026-10-04-script-baseline-evidence.json)。此工具尚未采集性能，不能从省去解析/遍历的次数推导提速。

固定提交 `a822fb7ff5eeb341a6b95bafa4f9eaef24fbd412` 的[生产 native off/on 正式运行](https://github.com/weapp-vite/weapp-vite/actions/runs/37192496301)现已结束。Linux/macOS 均完成采样并由门禁主动退出，分别判为 `unstable`、`regression`，不是超时；Windows 在旧暂存链接问题处失败，没有配对性能样本。预先固定的 TDesign 重复构建目标，Linux P50 为 4486.08→4408.42 ms（减少 1.73%），macOS 为 3770.95→3564.22 ms（减少 5.48%），均未达到 10% 门槛。

该正式运行测量已有生产 native 路径，不包含本轮 binding 或脚本 JS 基线实验。诊断构建中原生/Wevu 两个模板各零 native 调用，TDesign 各有两次调用，零失败/回退。零调用只表示没有覆盖 native 计算，不能排除加载或路径开销，也不能将越线直接解释为纯噪声。HMR 使用已有 120 ms polling watcher 协议，强制 GC 和产物读取发生在计时外并影响下一样本，不能视为默认 watcher 的无观测延迟；build RSS 为进程树采样峰值，HMR RSS 为 GC 后快照，不能混为同一内存指标。正式失败结果进一步约束生产接入，不替代 Stable DevTools runtime 最终验收。

Linux/macOS 的 100 项基础指标均完整；分别有 322/390 个 side-run 和 3124/3660 条 samples。Linux 的 P50/P95 门禁有 197 项通过、3 项不稳定；macOS 有 167 项通过、26 项不稳定、7 项在确认批次仍回退。持续回退均是 wall P95，涉及普通模板的 repeat build、script first edit / repeat restore、template repeat restore、style first restore，以及 Wevu script repeat restore / style repeat edit；确认批次回退约 6.09%–28.69%。原始报告 hash、完整性、全部未通过指标的首批/确认数值、失败阶段和限制见[正式运行证据](./2026-10-04-rust-production-run-status.json)。后续优先定位这些整链尾延迟及 native 加载成本，再决定是否修改生产接入；本轮没有降低阈值或重新派发固定运行。

## 第十六轮：七路 JS 基线计时入口与加载边界核查

为判断脚本完整阶段迁移到 Rust 的剩余空间，新增七路 `compileVueFile` 配对采集。先执行全部 32 场景正确性，再串行测压力模板、零售详情、Wevu 首页各两批；每组拥有七个独立持久 worker，预热 14 轮、采样 42 轮，14 轮周期平衡执行位置和前序。计时内保留真实编译及诊断 hook 成本；reset、输入 hash、IPC、序列化、对照与计数快照在窗口外。每次都与首次原始编译完整输出比较，各组还对齐先行正确性 oracle；没有计时外预填分析结果。

正确性和计时共用执行逻辑；binding 与脚本实验共用进程所有权传输。父 IPC 断开后，worker 等当前启动/编译完成，再卸载 hook 并退出。新增严格报告验证及逐对聚合，保留原始观测，不混合语料/批次，不把收益 P95 当成坏尾延迟。编译失败、输入漂移或输出分歧时保存完整诊断副本，CI 上传对应文件；Windows 多层 JSON 转义路径仅在落盘副本中脱敏，原始比较和摘要不变。

23 个文件共 132 项测试通过，两组脚本 typecheck 和定向 ESLint 通过。真实 IPC smoke 串行覆盖七种实现的重复编译、预期错误、恢复、关闭及重复关闭；全部进程确认退出。重构后重新执行 448 次脚本正确性检查，及 13 场景五路 native 完整编译对照，全部通过；后者采样轮数为零。本机仍有其他任务的构建/E2E，没有收集新的本地性能样本。CI 新增独立的 `script-baseline-performance` 手动入口；实现、输入及输出身份见[采集工具证据](./2026-10-04-script-timing-collection-evidence.json)。在取得实际样本前，不宣称这四项 JS 优化提升性能。

另核查了正式门禁的加载边界。`native.ts` 在首次实际分析请求才 require addon，成功/加载失败均在进程内缓存；模块 import 本身不加载。a822 和当前相关实现一致。普通原生模板与 Wevu 的独立 build 诊断不仅 calls=0，wrapper 的 processes 也为零，而外层 lifetime preload 完整记录两个 CLI 进程且没有 load failure，支持这些诊断构建没有加载 addon。正式 timed runs 的 native 零值是初始化占位，不能当成逐次观测；HMR 仍缺同等证据。

七项确认回退中六项发生在 dev 初始构建之后，一次启动加载不能直接解释持续 HMR 延迟。强制 GC 和完整产物读取在计时后发生，可能影响下一样本，但会话首次 edit 不能归因于前一次强制 GC；也不能直接减去 120 ms polling 来取消回退。下一步可在同一首次请求边界对照 off、阻止加载并真实 JS fallback、只加载但 JS fallback、实际 native 四种诊断模式，并将事件关联到启动/edit/restore；没有 loader 请求的工程不能被强制预加载后冒充生产路径。

完整 `transformScript` 的 Rust 边界还有一项必要前提：class/style、template-ref 等元数据携带 Babel Expression，需先定义紧凑表达式输入契约，不能直接跨边界复制整棵 AST。当前 native Cargo 只有 Oxc parser/AST/visitor/可选 semantic，没有 codegen/transformer/sourcemap 集成；现有 TS visitor 对 enum、namespace、parameter property 的行为也不能被通用 TS 转换器直接替代。待更强 JS 基线采样后，再按剩余热点决定阶段迁移，而非增加细粒度 props/page-meta NAPI。


## 第十七轮：四模式懒加载源码探针

新增独立的 `scripts/nativeLoadDiagnostic` 工具，为后续 HMR 加载归因先验证观察边界。四个全新进程分别关闭 native、禁止加载并走 JS、仅加载后走 JS、实际 native。preload 只订阅事件，wrapper 仅在生产代码真实首次 require 时初始化；不修改生产源码、不提前加载 addon、不新增逐节点或细粒度 NAPI。

本机真实 release 绑定的最终探针四路输出完全一致：

| 模式 | wrapper 初始化 | addon 加载 | native 调用 | 分析结果缓存命中 | 已观测 fallback 事件 |
| --- | ---: | ---: | ---: | ---: | ---: |
| off | 0 | 0 | 0 | 0 | 0 |
| on-no-load | 1 | 0 | 0 | 0 | 22 |
| load-only | 1 | 1 | 0 | 0 | 22 |
| actual | 1 | 1 | 5 | 2 | 3 |

actual 的三个异常全部来自同一个故意无效的源码阶段，分别经过现有批量分析及其 fallback 路径；有效 batch、缓存告警、末项复用和 recovery 无异常或 fallback。此结果也说明一次坏输入可能经过多次既有 native 尝试，不能把事件数当成唯一源码数或 Rust parse 数。缓存命中分别属于滚动告警和末项分析复用。模块 import 与无 hint 阶段均未触发 wrapper。

最初使用默认 Babel 配置的探针未通过完整输出比较，记录已保留。原因是 `mayContain` helpers 在未提供 parser 时保守返回 true，native 返回精确值；最终仅把此诊断的脚本分析与 feature flags 固定为现有 Oxc fallback，以比较精确结果，滚动告警仍保留原路径来验证缓存。没有修改生产契约或归一化掉差异，不能据此声称默认 Babel/native 的所有中间结果完全相同。

31 项工具测试、局部 typecheck 和定向 ESLint 通过；独立复核最终报告的源码、逐模式输出及原始轨迹 hash。验证器要求完整进程起止、事件阶段及调用顺序，分别锁定缓存、故意解析失败与恢复，并禁止有效阶段发生 native fallback。CI 接入三平台源码探针，只上传公开报告；私有轨迹、生成 wrapper 和 owner 文件不上传。来源、首轮排除记录及最终结构化输出见[加载探针证据](./2026-10-04-native-load-source-evidence.json)。

这里仍没有构建、HMR 或性能样本。wrapper 初始化只观察首次未缓存 require，不等于每次 loader request；已有 fallback channel 不覆盖所有缺失方法分支，零事件不证明没有 JS fallback；`.node` 增量也不代表整个进程所有 native 加载。后续真实 HMR 需要驱动阶段标记、正常退出和产物对照，不能用本轮结果解释已有尾延迟回退。

七路 JS 基线的固定提交 `2d53ed9c4` [采样运行](https://github.com/weapp-vite/weapp-vite/actions/runs/37202918268)已发起；本轮加载诊断不改变该运行的源码或采样目标。三平台数据完成并独立复核前，仍不扩大生产 Rust 覆盖。


## 第十八轮：三平台更强 JS 基线的实际采样

固定提交 `2d53ed9c4` 的[七路采样](https://github.com/weapp-vite/weapp-vite/actions/runs/37202918268)现已在 Linux、Windows、macOS 全部成功。本轮初始检查点仅 Linux/Windows 完成、macOS 排队；以下补入相同提交的 macOS 完整证据。每个平台均独立核对 230 份 Git 源码身份、14 份报告 hash（1 份 correctness 汇总、7 份 correctness worker、6 份 timing report）、448 次完整正确性输出、42 次初始计时对照与 1764 次正式观测；每平台重算 396 个分位数和 1512 条配对记录，三平台共 1188 个分位数、4536 条记录，全部一致，无未释放 AST 所有权或清理错误。顶层 summary 的 digest 另外保留在原始清单中。原始报告另保留逐轮值，未合并不同语料或批次。

以下是同 loader 原逻辑控制组→四项 JS 组合优化的逐对节省百分比 P50；正值表示耗时减少：

| 平台 | 压力模板第一 / 第二批 | 零售详情第一 / 第二批 | Wevu 首页第一 / 第二批 |
| --- | --- | --- | --- |
| Linux | 4.18% / 1.45% | 19.93% / 19.23% | 20.37% / 18.84% |
| Windows | 5.56% / 1.78% | 22.03% / 26.02% | 18.93% / 18.76% |
| macOS | −1.15% / 4.71% | 19.49% / 18.41% | 20.91% / −2.05% |

macOS Wevu 第二批是组合优化未获得一致收益的反例。两组 wall P50 分别为 25.234→19.097 ms，分别取分位数后的比值减少 24.32%，但逐对节省百分比的 P50 为 −2.05%；42 对中各有 21 对正收益、负收益。这是不同统计量，不能用两组 wall P50 的比值替代逐对结果，更不能把 Linux/Windows 的约 19%–26% 收益推广到三平台。

组合版在 Linux/Windows 十二组的 wall P95 均低于控制组；macOS 六组中有两组回退：压力第二批增加 3.16%，Wevu 第二批从 36.479→40.455 ms，增加 10.90%。macOS 组合版 RSS P50 仅压力第一批增加 2.51%，其余五组降低。单项优化仍有回退：Linux Wevu 第二批 `props-no-scope` 的 wall P95 增加 8.21%；Windows 压力第二批 `ast-reuse` 与 `props-no-scope` 分别增加 7.45%、14.12%。macOS 零售第二批 `ast-reuse`、`page-meta-gate`、`reserved-props-gate` 的 wall P95 分别增加 13.91%、11.18%、21.70%；Wevu 第二批四项单独优化均有 wall P95 回退，其中 `page-meta-gate` 为 47.97%。macOS 压力第一批 `props-no-scope`、`page-meta-gate`、`reserved-props-gate` 的 RSS P50 分别增加 5.43%、6.06%、5.94%。不能把各项百分比相加，也不能将 JS 组合收益与此前 Rust 实验收益相加。

实际计数表明三个语料每次都复用一次 AST、执行一次无 scope props visitor、跳过一次 page-meta 分析；reserved-props 只在两份真实页面跳过，压力模板仍执行分析，因此压力语料中 reserved-only 的表观变化不能归因于省去工作。完整正确性另覆盖源码变化、不提供 AST、宏和保守 guard 的正负分支。

loader 本身存在干扰。Linux 压力与零售两批的 baseline→control wall P95 增加 5.64%–7.03%；Windows control RSS P50 相对原始编译器增加 4.35%–19.72%。macOS Wevu 两批 baseline→control wall P95 分别变化 +17.10%、−20.08%。应使用同 loader control，同时不能据此保证生产 RSS 降低，或把已观察的回退直接归为 loader 噪声。RSS 是编译后 worker 快照，CPU 包括进程所有线程，Windows CPU 计数有较粗粒度；共享 runner 负载未被独立测量。macOS 使用 Node 24.20.0/arm64/3 CPU，Linux/Windows 使用 Node 24.21.0/x64/4 CPU，跨平台绝对耗时不可直接比较。

结果支持优先消除重复工作，并在更强 JS 基线上选择 Rust 完整计算阶段；macOS 反例意味着尚不能声称这组 JS 优化在三平台稳定获得真实页面收益。它仍只是固定选项、温热 `compileVueFile` 的 JS 诊断，不是 Vite 构建/HMR，也不是生产 10%/5% 门禁通过。宏转换、AST 所有权等优化仍只通过诊断 source loader 启用，生产源码未改。接下来应在更强 JS 基线上重新采 CPU，再决定整体 `transformScript` Rust POC 是否有足够剩余收益。

预热 14 轮由源码协议和报告字段确认，未保存每轮预热原始观测；独立复核不能声称重新计数。14 轮顺序设计平衡每个实现的位置及单轮内前序，跨轮边界并非均匀。完整正确性保留原始序列化输出，计时报告保留完整比较后的摘要；源码身份覆盖声明的 230 文件和真实语料，不覆盖所有已安装依赖文件。三平台全部单项结果、反例、来源 hash 见[JS 基线采样证据](./2026-10-04-script-baseline-timing-evidence.json)。
