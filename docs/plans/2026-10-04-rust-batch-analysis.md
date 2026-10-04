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

## 第十九轮：更强 JS 与 Rust 批处理组合、逐次完整编译采样

新增 `scripts/optimizedCompilerAnalysis`，先安装 binding loader，再安装脚本 loader，组合原始编译器、双 loader 原逻辑控制、优化 JS、优化 JS 摘要缓存、优化 JS＋Rust 五路。生产源码、公开接口及 Rust 实现不变。复用既有 32 个脚本场景和 13 个模板场景的原始选项，五路各执行两次，共 450 次完整返回值、sourcemap、告警和公开错误对照通过。额外要求脚本正负分支、模板结果消费、独立 scoped-slot flush、JSX 同步分析和两个故障注入回退实际发生，避免未命中优化也被当作有效实验。

随后在三份既有代表 SFC 上，每组独占新进程，初始编译一次、预热 14 次、采样 20 次。15 组全部通过，共 525 次完整输出校验、300 份独立原始 profile、7672 个主线程样本。各组都与原始编译器 oracle 相同；native 三语料每次仅一次调用，分别消费 724、64、34 项输入，无意外 fallback 或所有权残留。最终记录覆盖 269 份源码/配置身份，前后相同。 独立 Python 审计重算全部 7672 个原始样本，核对逐模块/函数归因、300 个窗口和 15 个 worker 生命周期均不重叠；315 次优化模式调用确实执行脚本优化，105 次 native 编译调用均命中批处理。与之前计时工具不同，本次预热逐次保留摘要；它仍不是计时实验。

采样仅包围实际 `compileVueFile` 回调；输入哈希、输出序列化/对照、指标快照、原始图写盘在窗口外。每次图在该轮结束后释放，完成所有编译才读回合并。父进程重新核验 15 份 worker 报告、300 份图的 hash、顺序及不重叠区间，再从原始图重算摘要。合并结果只提供计数，没有拼接连续时间轴；原始图和完整输出保留本地，CI 只上传脱敏摘要。

本地组合 Rust 路径的初步样本如下，各列均以该组所有 V8 主线程样本为分母：

| 语料 | 样本数 | Babel traverse self | Babel parser self | Babel generator self | Inspector self | transformScript inclusive |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 压力模板 | 692 | 20.38% | 8.24% | 17.05% | 2.89% | 36.85% |
| 零售详情 | 461 | 34.06% | 12.80% | 5.21% | 4.56% | 24.51% |
| Wevu 首页 | 156 | 17.95% | 21.15% | 5.77% | 12.82% | 22.44% |

`transformScript` 与 Babel 列存在栈包含关系，不能相加。V8 不能给出 Rust 内部栈、其他线程 CPU 或整个进程耗时。固定执行顺序、较高系统负载、调用间报告分配及可见 Inspector 开销限制了本轮归因，尤其 Wevu 只有 156 个样本。它仅支持继续检查脚本阶段，不提供附加 Rust 提速结论；不能将样本数减少写成耗时减少。独立 CI 三平台归因由新的可选 `optimized-compiler-cpu` 输入触发，使用独立 concurrency group，不重跑或替换已完成的固定性能验收。

下一项有意义的 Rust 边界仍是整个 `transformScript`：parse、scope、改写和 generate 共享 AST。单独搬一个 visitor 或 generator 通常仍需保留 Babel 解析/生成及跨界 AST 搬运。完整阶段 POC 还必须解决已改写模板表达式的源码契约（包含原始/投影循环与条件）、Vue/Babel 宏语义、自定义 TypeScript 删除规则、注释和 sourcemap。标准 Oxc lowering 不能直接替代现有行为。应保留既有 JS fastSetup，native 一次请求完成完整阶段，unsupported/error 整段回退，并记录真实页面命中率；本轮没有实现或宣称这项完整阶段迁移。

新增工具共 89 项测试、局部 TypeScript 和定向 ESLint 通过，代码按执行、正确性、采样窗口、工作负载、父进程复核分文件，均未超过 300 行。原始来源 hash、逐组计数、采样区间、环境与完整限制见[组合编译证据](./2026-10-04-optimized-compiler-evidence.json)，复现命令见[工具说明](../../scripts/optimizedCompilerAnalysis/README.md)。真实 Stable 微信开发者工具 runtime 仍未完成最终验收。

同轮修复 PR CI 暴露的 `snapshotTemplates.test.ts` fixture 缺失依赖：owner 校验进入真实声明读取时需要 JSON service，现与 WXML service 一样初始化真实服务，不给生产逻辑增加可选回退。原 8 项断言、`weapp-vite` typecheck 和定向 ESLint 通过；此前 Ubuntu/Node 22 作业独跑 coverage，其他矩阵命令不同，因此不把这个失败误归为 OS 兼容性差异。


## 第二十轮：真实脚本阶段捕获与 Oxc 打印兼容性

本轮新增默认关闭的 `experimental-script-transform` Cargo feature 与独立 `scripts/nativeScriptTransform` 工具。一次 N-API 请求对**现有转换器已经生成的 JS** 完成 Oxc 0.152 parse、语义校验和 codegen/map，既不回传 AST，也不逐节点回调 JS。这是完整脚本迁移的输出基础设施实验，尚未实现 `transformScript` 的 Vue/Wevu 改写，也未接入生产路径或测量性能。

先用三个全新 Node 进程比较原始编译器、优化后的 JS、优化后附加捕获器的 JS。45 个场景各重复两轮，共 270 次完整返回值、map、warnings 和错误诊断逐字一致。捕获器通过既有 loader 返回的真实优化源码包住入口，保存每个调用所属 record，原 options、warn callback 和隐藏 AST transfer 均原样流转；失败捕获不能被编译器错误序列化隐藏。72 条实际 stage 记录全部成功且 fastSetup 均 miss，两轮请求、完整结果和分渠道告警相同，没有所有权残留。剩余 18 次是保留的无该阶段路径，不能把 90 次调用都称为脚本转换；本轮没有 fastSetup 实际 hit 证据。

其中 Wevu 主源码输入 3662 个 UTF-16 单元，三个表达式字段生成 745 字符；零售主源码 13054 单元，三个字段生成 4870 字符。全部 72 次捕获的表达式 JS generator 共调用 644 次、生成 181252 字符，这不是零成本 bridge，也不是 native parse 数。表达式保留独立 role、原始/投影条件与循环字段、顶层 span 和身份，不能由显示用 `exp` 重建，且根 span 不足以恢复各子 token 的来源。真实两页的 class、key 投影和 7/14 个 inline events 均保留在请求中。

72 份成功 stage 输出各测两种 minify，另有八份独立语法样本各测两种模式，共 160 次 Rust 打印，全部返回合法成功状态。另验证六个 unsupported/parse/semantic 负例及一个 raw lone-surrogate 拒绝。打印对照结果如下；每列覆盖独立的门禁，不可互相替代：

| 检查 | 非压缩（80 次） | 压缩（80 次） |
| --- | ---: | ---: |
| 与输入 JS 字节完全相同 | 0 | 0 |
| 去位置 AST 结构相同 | 80 | 22 |
| 注释文本/顺序相同 | 79 | 79 |
| PURE/NO_SIDE_EFFECTS parser 归属相同 | 80 | 80 |
| 全部选定 map 锚点对齐 | 70 | 20 |
| 结构、注释、归属、map 联合检查通过 | 69 | 19 |

整体 `completed=true`，但 `comparisonPassed=false`，72 次联合检查未通过；88 次通过也不表示完整产物字节一致。诊断模式可显式 `--allow-differences` 保存所有差异并成功结束采集，严格默认模式仍返回失败。CI 明确将此步骤标为诊断，只上传脱敏摘要；步骤成功不能被当作生产兼容门禁通过。

58 次结构差异全部来自 minify 将 `StringLiteral` 打印成无插值 `TemplateLiteral`，每处 cooked value 与原字符串相同；独立审计未发现其他 AST 变化。这是当前严格结构契约未满足，不是这些样本已证实的值语义错误，不能为了通过而删除差异。格式与 `Function.prototype.toString` 的可观察变化仍然存在。

真实 Wevu 与零售的非压缩 AST、注释以及每次全部 485/1277 个标识符起点和实际组合映射对齐，但模板字面量的 quasi 起点分别仍有 2/35 处差异，故两页均未通过完整探针。首 quasi 的查询会落在开反引号，空尾 quasi 会继承前一个表达式的映射；这不是已证实的 UTF-16 计数错误。独立 private class 样本也存在 `#value` 整个 token 与 Babel 子 Identifier 起点相差一列的粒度差异，未证明 private 运行时行为损坏。普通注释样本则确实由四条减少为三条，丢失 `// ordinary comment`。现有 PURE/NO_SIDE_EFFECTS 样本归属保持，并不证明所有第三方 annotation 策略都已覆盖。

oracle 特别补了三个反例：不含标识符的源码配空 map 不得通过；同一 PURE 注释移动到另一调用即使文本/顺序和所有位置仍对齐也必须失败；组合检查必须真正组合两张 map，再从输出坐标查询来源。仅对已经相同的坐标查询同一 upstream map 两次是恒等式，不能作为 composition 证据。打印的原始结果在私有报告保留，单个坏 map/代码的对照异常也会单独记录，后续观察继续完成。

独立 Python 审计确认 298 份源码、16 份构建输入、270 份完整输出、72 条有归属记录及 160 份打印结果与摘要一致；它不重新解析 AST，也不证明 runtime 或密码学构建来源。最终严格运行的源码、binary 身份前后相同。

10 项 Rust 测试、默认/实验/功能并存的 cargo check、78 项工具测试、局部 TypeScript 与 ESLint 通过。默认 Cargo 依赖树不含 codegen、semantic 或 sourcemap；没有生产 JS 导出和用户配置变化，无新增 changeset 或脚手架 bump。新增实现按职责拆分，全部低于 300 行，既有 lib 仅注册隔离模块。

本轮证据只来自本机 macOS arm64，三平台检查随 PR CI 验证；第十九轮固定提交的独立 CPU 作业仍需完成和复核，不重复触发。真实 Stable 微信开发者工具 runtime 仍未完成最终验收。下一阶段应先确定完整转换的注释/map 契约，再在一次 native 请求中实现有序改写，保留 fastSetup 与整段 fallback；不将本打印器单独接入热路径，也不声称已经获得额外 Rust 提速。

来源 hash、独立审计、逐项计数与限制见[脚本打印探针证据](./2026-10-04-script-transform-printer-evidence.json)；命令见[工具说明](../../scripts/nativeScriptTransform/README.md)，完整语义审计见[阶段边界](../../scripts/nativeScriptTransform/BOUNDARY.md)。


## 第二十一轮：实际 Rust 脚本改写与严格来源对照

新增 `transformScriptNative`，在默认关闭的 `experimental-script-transform` 内接收一次完整源码和 version 1 请求，完成主脚本解析、语义信息收集、自定义 TS 删除、作用域准确的 expose 改名、导入路由、组件默认值、初始 data、绑定清单、class/style/key 计算、内联事件、function prop paths、能力安装及最终注册。主源码只解析一次；metadata 和合成片段仍在 Rust 内分别解析，不把一次 N-API 调用当成所有内容只有一次 parse。没有完整 AST 往返或逐节点 JS callback，也没有将 Babel 后处理放到 native 输出之后。

JS bridge 保留 26 个声明选项、字段顺序、undefined 与属性描述符。表达式按原角色传源码；warn callback 和已有 AST transfer 仍由原调用者拥有。runtime 路由、marker、private import allowlist、installer/helper 名称从当前常量和四份源码静态提取，首次共五次解析，之后每进程缓存。Rust 有序 JSON 解码仅省略允许的 optional undefined，路径单独返回；负零、数组空洞、不可枚举 defaults 和未知字段明确拒绝。adapter 在校验完整成功结果后才发布 warning，native 异常或 unsupported 可走整段 JS fallback；caller warning 自身抛错不触发重做。

真实 Wevu/零售输入没有裁掉元数据。Wevu 的一个 class computed、7 个 inline events、16 条 manifest 与 setup 初始数据，零售的两个 computed（含条件 key 投影）、14 个 inline events、58 条 manifest、27 个 function prop paths、page feature、外部业务 import 都由 Rust 生成。未覆盖的宏、app、propsDerivedKeys/scoped slots、template refs/layout/CSS、复杂 component/capability shape 保持显式 unsupported，不因提高命中率而放宽边界。

正式严格运行先用三个新进程执行 45 场景两轮，270 次完整编译结果、map、告警和公开诊断逐字相同。随后将捕获到的 72 条真实 stage 请求独立交给 Rust：36 次成功、36 次 unsupported。成功记录含重复轮次与跨语料复用，实际只有 10 个不同的 source/request 组合，不能当作 36 个独立功能样本。36 份成功结果全部通过去位置 AST、注释顺序、PURE/NO_SIDE_EFFECTS 归属、返回元数据和告警对照；两真实页面各两次均原生成成功。原始 code/map 均与 JS 字节不同；**36 份都没有通过来源映射对照，因此 nativePassed=0，严格命令 exit 1，comparisonPassed=false。** completed=true 只代表完整收集，不代表兼容门禁通过。

map 对照查询两份实际 stage map 从各自产物回到同一真实源脚本，包括 UTF-16 坐标及 name。新生成片段清空 span，与 Babel 继承邻近位置的行为产生大量差异；此外仍有原源码锚点、映射名称、模板字面量和基线映射自身覆盖限制。两边都缺失映射也不能自动视为来源覆盖通过，更不能把所有差异直接归为 Rust 独有错误。两真实页面中，Wevu/零售分别有 364/785 个基线有映射、native 未映射锚点，全部处在生成区域；其中 313/726 个基线坐标来自 GLB 继承。源脚本区域的坐标差异为 4/22 个，集中在 expose shorthand 与 TemplateElement，另各有两个名称差异锚点。Wevu 的 7 个越界 finding 发生在基线 inline 元数据映射，均与上述单侧映射路径重叠；不能重复加总成独立路径数，也不能据此认定 native 的未映射满足来源覆盖。没有伪造新片段位置以追平基线。逐项计数和审计边界见[完整阶段证据](./2026-10-04-script-transform-stage-evidence.json)。

53 项 Rust 测试、161 项工具测试、局部 TypeScript/ESLint 通过；默认与实验组合 cargo check 通过。Rust 测试直接调用当前 TS oracle，覆盖真实页面 metadata 求值、嵌套 loop/raw key 条件、告警/冲突、setup seed、显式 this 参数、expose 类型/值命名空间、router hooks 和重复 defaults。合成对象括号形态曾触发 native 崩溃，已用解析选项修正并补 Unicode/关键词/转义 key 回归；正式运行没有该失败。默认正常依赖树不引入 codegen/semantic/sourcemap/indexmap。实现按职责拆分，各实现文件保持 300 行以内，Rust 文件用系统 rustfmt 检查，isolated 1.99 工具链用于编译。

同轮完成固定[独立 CPU 运行 37207342592](https://github.com/weapp-vite/weapp-vite/actions/runs/37207342592)的摘要审计：Linux/macOS 成功，Windows 在采样前的测试 ESM import 边界失败，未产生 Windows 样本。已将测试的绝对路径改成 file URL，13 项定向测试和 lint 通过；未重跑该固定 benchmark。两平台 269 项 Git 源码身份、30 组运行、1050 条摘要观测和 600 个采样窗口一致；只有 sanitized summary 可供复核，原始 profile/worker 输出没有下载，不宣称已重算原始栈。optimized-js Babel self 的占比仍较高，但不能据 CPU 样本比例推导提速，详见[固定 CPU 证据](./2026-10-04-optimized-cpu-ci-evidence.json)。

完整阶段输出尚未回灌 `compileVueFile`，没有新增性能采样、Vite/HMR 或真实 Stable 微信开发者工具 runtime 结果。实验继续默认关闭，没有扩大生产路径。下一步应处理真实源码与合成区间的 map 契约，再做完整编译/宿主对照和正式配对计时；当前不能承诺额外 Rust 收益，更不能承诺全项目两倍提速。本轮仅为内部实验和测试工具，不新增 changeset 或脚手架 bump。


## 第二十二轮：完整编译入口接入与原源码映射修复

本轮将 Rust 成功结果实际返回到隔离的 `compileVueFile`／直接脚本调用入口，原编译器继续组合 sourcemap。新增 loader 只用于显式诊断，生产入口和用户配置不变。unsupported、加载失败、解析错误、native 异常及坏 payload 仍由整段 JS fallback 接管；成功路径完整校验一次后才发布告警，告警回调异常不重做编译。实际编译语料验证 unsupported 回退，其他故障与告警所有权由合成测试覆盖，不能合称真实宿主验收。

同时修复原源码位置丢失：移动的 import 保留 imported/local 原 span，expose 改名保留绑定来源与原名称，空模板片段仅在原文分隔符可验证时补映射点。没有挪动 expose 到 Babel 的对象 key 坐标，也没有将 quasi 内容起点伪造成前一分隔符。codegen 准备不改变生成文本、没有额外 parse 或 N-API 调用，但增加一次 AST 遍历、源码位置索引及 map token 名称修复，其实际性能成本尚未测量。

正式严格实验在本机 macOS arm64 串行运行五个新进程。原始 JS、优化 JS、附加捕获器 JS、附加完整入口包装器 JS 四组各执行 45 场景两轮，共 360 次完整返回值、maps、告警和错误逐字相同。native 组另外执行 90 次完整调用：36 次实际交付 Rust 结果（34 次 SFC、2 次直接脚本），36 次 unsupported 后实际执行原 JS 阶段一次，18 次未经过该阶段。后两类共 54 次完整输出逐字保持一致，没有将回退候选数冒充实际回退证据。

72 条 native 阶段调用含重复轮次与共享 fixture，对应 24 个不同的源码／请求组合；36 条成功记录对应 10 个组合。Wevu 与零售两真实页面各两轮均成功使用完整 Rust 返回值，未裁掉 class、条件 key 投影和 inline events。90 次调用的非脚本／map 字段、公开告警、错误全部一致；36 份 native 脚本的去位置 AST、注释顺序和 PURE／NO_SIDE_EFFECTS 归属全部一致。每份实际交付的阶段结果也另作严格对照，而不只检查 native 曾返回成功。

**阶段及完整 native 结果均仍未通过 sourcemap 门槛，严格命令 exit 1，`completed=true`、`comparisonPassed=false`。** 完整结果 oracle 独立查询最终 map 到真实 SFC 来源，保留所有原始 maps，并核对全部编码分段的 UTF-16 范围和名称。两边都未映射的节点只说明所有权未核验，不能当作来源一致；不同于场景 filename/content 的 map（包括部分既有 inline.ts map）明确留为未核验，不构造虚拟来源。32/90 个完整检查满足当前比较规则，全部来自 JS 路径；这不是 native 通过率，也不把其余既有 JS 来源缺口算作 Rust 新回归。

生成区域来源仍有根因未解决：Oxc 跳过空 span，不主动产生 unmapped fence，压缩后注册／导出可 GLB 继承上一用户节点的位置；该缺陷已补诊断用例，但尚未修复。模板表达式更早经过独立解析、改写和 stringify，只有根 span 与结果字符串无法恢复逐 token 来源。后续需在上游 owner 保留真实 source identity、片段及变换映射，并按 AST 所有权隔离合成区间，不能按 helper 名猜范围或复制 Babel 越界位置。

61 项 Rust、212 项工具测试、局部 TypeScript／ESLint、默认及三实验 feature 并存的 cargo check 通过。Rust 仍有已记录的非致命未使用项警告；release 构建保留工具链 stripping 警告。实现文件保持 300 行以内；涉及的 Rust 文件格式同步，pre-commit／lint-staged 保留。实验及工具没有扩展生产行为，不新增 changeset 或脚手架 bump。

本轮没有运行性能采样、Vite 构建／HMR 或真实 Stable 微信开发者工具 runtime，不能宣称整链收益或 runtime 最终验收完成。后续先处理生成区间和表达式来源，再扩展运行时语义对照与正式计时。原始完整证据保留在独立目录，摘要与审计边界见[完整编译接入证据](./2026-10-05-script-transform-integration-evidence.json)。


## 第二十三轮：生成映射点隔离与真实编译复核

本轮在默认关闭的 Rust 完整脚本实验中，为没有主脚本来源的节点增加明确的 unmapped 映射点。打印前暂时使用独立保留行并平移真实 span／注释，Oxc 一次打印后恢复原 source 行、sourcesContent、有效 names 和 AST；保留行不会进入最终代码或 map。没有新增 parse 或 N-API 调用，但增加源码分配、AST 遍历及 map 重建，尚未测量净性能收益。

审查复现了同一输出坐标的所有权冲突：父语句和子 token 都写映射时，消费者可能读到较早的错误来源。finalizer 先校验每个原映射，再按打印次序保留最后的所有者并重建 names，最终 JSON 通过实际 JavaScript sourcemap 库的双向回归。注释、PURE／NO_SIDE_EFFECTS、raw literal、返回的 legal comments、真实 NUL、UTF-16／CRLF／Unicode 换行、空 span 及异常恢复也有对照。另修复阶段 oracle 漏算 U+2028／U+2029 的行数问题，三个真实 Babel map 反例由失败转为通过，真正越界的相同双侧 map 仍被拒绝。

重建 release addon 后，正式严格实验再次得到 360 次 JS 完整控制输出逐字一致。native worker 的 90 次完整调用仍为 36 次实际 native、36 次实际单次 JS fallback、18 次无 stage；72 条阶段调用对应 24 个不同源码／请求组合，36 条 native 成功对应 10 个组合。两真实页面各两轮的 native stage 代码实际进入最终 script。36 份 native 的 AST、注释与 annotation 一致，90 次调用其余返回字段、告警和错误一致。

与上一轮在相同输入下逐条复核，90 份控制输入／预期、72 条阶段源码／请求均相同；36 份 native 代码及 72 份可解析最终脚本逐字相同。旧、新 native stage 共 16002 个 anchor 中，86 个导入 specifier／source 锚点由有映射变为 unmapped，其余来源不变；完整脚本 map 也观察到同一批 86 个变化。该计数包含重复轮次，不能把两个层次相加当作独立修复数。

| 代表页面（每次重复） | native 旧→新 stage 锚点变化 | 最终 map 旧→新锚点变化 | 当前最终来源检查 |
| --- | ---: | ---: | --- |
| Wevu 首页 | 3 个 mapped→unmapped | 3 个 mapped→unmapped | 737 个锚点；402 个双侧 unmapped，21 个来源差异 |
| 零售详情 | 8 个 mapped→unmapped | 8 个 mapped→unmapped | 2043 个锚点；907 个双侧 unmapped，77 个来源差异 |

**严格命令仍 exit 1，`completed=true`、`comparisonPassed=false`，native 完整来源通过数仍为 0。** 32 项完整比较通过来自 14 次 fallback 和 18 次无 stage；54 份完整逐字一致来自全部 fallback／无 stage。stage findings 从 8930 变为 8844，完整 findings 仍为 57388；这些计数包含基线缺陷和来源未核验，不能用作质量、回归或性能指标。

本方案只覆盖 Oxc 实际写映射的位置。逗号、分号、部分开括号、member 分隔符及 import 的 `from` 关键字仍可能 GLB 继承，已有明确诊断用例；不能宣称所有字符区间都隔离。模板表达式早期的解析、归一化、改写和 stringify 仍丢失逐 token 来源，unmapped 也不证明它们全是生成代码。后续需从 Vue loc 建立独立 occurrence 和不可变 source owner，贯穿各转换的 copy／derived／generated／unknown 关系；全局文本缓存 AST 不能绑定某个文件的位置。这条上游路线尚未实现，严格 oracle 不因此放宽。

78 项 Rust、24 项受影响工具测试、局部 TypeScript／ESLint／rustfmt、默认及三实验 feature 合并 cargo check 通过。独立审计复核 347 份源码、52 份构建输入、139 份正式证据与二进制身份，并重放全部 90 个完整及 36 个阶段 oracle。新增实现文件均低于 300 行；实验无新增依赖、生产入口或用户配置变化，不另加 changeset／脚手架 bump。构建仍有已记录的非致命 stripping 与 unused 警告。

本轮没有性能、RSS、构建／HMR 或真实 Stable 微信开发者工具 runtime 采样，未完成最终 runtime 验收。实验继续默认关闭，不承诺整链提速。公开摘要与可复核 hash 见[生成映射点证据](./2026-10-05-script-transform-provenance-evidence.json)。


## 第二十四轮：完整脚本的受控 Node 行为对照

新增 `semanticCheck.ts`：先重新执行严格完整编译诊断，父进程重放控制组、完整返回值和阶段 oracle，再将两页各两次编译的 JS/native 最终 script 原样交给八个独立 Node worker。每份执行请求均核对实际阶段所有者、native 成功交付、零 fallback、最终 script 与阶段 code 相同及完整源码 hash。没有删除 import、截取 AST 或再次编译脚本；未知 import/export、动态 import、无结果、错误退出和进程超时均会失败。

场景复用真实 Wevu reactivity、template helper 和 inline dispatcher，注册、平台 API、业务数据、网络与导航使用显式有限桩。独立断言检查 default export 与注册对象的引用身份、安装/注册/setup/expose 顺序、初始 data 的独立性、manifest/flags/function prop paths、生成 computed 及全部 inline handler。还覆盖数组/对象/数字循环、状态与 props 优先级、关闭条件不求值、受控异常，以及零售页加载中间态、服务结算、返回 Promise 的等待和错误后的状态。

| 每个独立 worker 的观察 | Wevu 首页 | 零售详情 |
| --- | ---: | ---: |
| 独立断言 | 29 | 59 |
| 实际 inline 调用／不同 handler | 9／7 | 16／14 |
| 实际 computed 调用／不同 computed | 7／1 | 9／2 |
| 实际 lifecycle 调用／不同 hook | 0／0 | 3／2 |
| 受跟踪异步任务 | 0 | 13 |
| 未结算任务／未处理错误 | 0／0 | 0／0 |

本机 macOS arm64、Node 24.18.0 的正式结果为 **4/4 组受控行为对比通过，8/8 worker 成功**。每组的 imports、exports、独立断言、实际调用账本、带类型观察、顺序 trace、异步账本和 cleanup 均相同；effect scope 全部释放。两次编译是重复轮次，仍只有两个真实页面，不是四个独立功能场景。

父进程不会只相信 `passed`：成功必须具有合法非空观察与一次 module evaluation，快照内断言值及调用顺序必须对应原始账本，各 handler/computed/lifecycle 每条调用必须实际执行一次，异步状态必须与最终 pending 一致。快照保留 undefined、负零、NaN、空洞、引用与错误 cause；函数仅记录形状，行为由实际调用和独立断言补证。新增负例覆盖空观察、伪造调用、缺失/未知事件、未知 import/export、动态 import、空 handler、错误、未结算任务、超时及清理失败。

新运行同时保留 360 次 JS 完整输出逐字控制；native 的 90 次完整调用仍为 36 次实际 native、36 次实际单次 JS fallback、18 次无 stage。严格编译兼容仍失败，**总命令实际 exit 1，`completed=true`、`semanticComparisonPassed=true`、`compilerComparisonPassed=false`、联合 `comparisonPassed=false`**。行为观察通过不消除 map 差异和未覆盖能力，不扩大生产 native 入口。

正式采集前后 369 份源码身份、原 v7 addon 及声明 helper 四个包的 842 份 src/dist/manifest 身份一致；原始请求、报告和编译证据也复核了字节 hash。helper 清单覆盖本轮已知入口，不是自动解析的全部 node_modules/Node 工具链字节闭包。本轮未修改 Rust，复用上一轮已构建并固定身份的 addon，没有以新构建冒充旧二进制。

59 项新增工具测试、定向 ESLint 与脚本 TypeScript 检查通过，新增实现文件均低于 300 行。工具、场景与报告按职责拆分；无生产接口或行为变更，不新增 changeset／脚手架 bump。详细计数与独立审计见[受控行为证据](./2026-10-05-script-transform-semantic-evidence.json)。

这些结果只覆盖有限 Node 宿主和受跟踪 Promise／已观察状态，不能证明所有脱离调用链的 continuation，也不能替代完整 Wevu Component 宿主或真实 Stable 微信开发者工具。未完成最终 runtime 验收，本轮没有性能、RSS、Vite 构建／HMR 或跨平台采样；整链提速门槛仍未满足。


## 第二十五轮：真实模板 handler callee 来源贯穿

本轮在默认关闭的完整脚本实验中，补上 `v-on` 内联 handler 名称的真实模板来源。诊断加载器在上游仍持有 Vue 指令、完整 SFC 和原解析结果时记录 occurrence，通过原 inline asset 的 WeakMap 关联；原生产 AST、options、metadata 和共享解析缓存不增写字段。请求顶层的可选 `provenance` 一次传递完整来源与 UTF-16 范围，不增加 N-API 往返，也不传完整 AST 或逐节点回调。

Rust 先核对精确原文切片、字符边界、原直接 callee AST、inlineId 及生成根调用形状，然后只将成员名 token 关联到原 handler。多来源 codegen 的内部源码区将外部来源放在主脚本之前，保持主脚本 EOF；打印后恢复各来源、names、注释与 AST。最终诊断合成只将 `inline.ts` 经主脚本 map 回溯，直接模板来源保留。JS 控制与 fallback 仍调用原合成函数，完整产物逐字门槛保留。

父进程另外从原始 SFC 解析 on 指令，核对真实 asset 次序，并沿实际 metadata AST 路径查找输出 callee；同列必须存在明确映射分段，真实 map consumer 也必须精确返回对应源 token。重复文本不能交换归属，参数里的同名标识符不能冒充 callee，无事件的展示 slot 不影响检查，含候选 handler 的 slot 子树仍拒绝。CRLF 预处理后无法证明完整原文与 descriptor 对齐的来源记录 unsupported，不补猜测偏移。

正式复跑得到 **360 次 JS 完整控制逐字相同**。native 的 90 次完整调用仍为 36 次实际 native、36 次实际单次 JS fallback、18 次无 stage；54 份 fallback／无 stage 完整输出逐字保持。与第二十四轮逐条对照，90 个输入与控制输出、72 条 stage 源码／options 相同；去掉新增旁表后的请求结构相同。36 份 native stage code、72 份可解析最终 script 均逐字不变。

| 本轮来源证据 | 范围 |
| --- | --- |
| 真实 Wevu 首页 | 7 个独立 handler callee，在阶段及最终 map 都精确命中原模板 |
| 真实零售详情 | 14 个独立 handler callee，在阶段及最终 map 都精确命中原模板 |
| 额外事件 fixture | 1 个独立 callee，两个 map 层都通过 |
| 压力 fixture | 24 个 occurrence 已捕获，但整个 stage 走 JS fallback，不计入 native 映射覆盖 |
| 全语料重复检查 | 12 次多来源合成，各 map 层 88 次 callee 检查；不是 176 个独立 token |

捕获快照共有 4 个 source、46 个不同 occurrence，真正由 native 交付来源的是其中 22 个。sfc/binding 两个语料入口各重复两轮，不能将重复检查当成独立页面。两真实页的受控语义仍为 **4/4 对比通过、8/8 worker 成功**；实际 handler/computed/lifecycle 调用、异步账本与 cleanup 门槛保留。

**严格命令仍实际 exit 1，`completed=true`、`semanticComparisonPassed=true`、`compilerComparisonPassed=false`、联合 `comparisonPassed=false`。** 顶层命令、编译子进程及八个语义 worker 均保留进程退出记录。严格完整比较仍只有 32 项通过，来自 14 次 fallback 与 18 次无 stage；native 严格通过数为 0。新增 callee 来源检查是额外证据，没有改变旧 AST/map oracle 或把缺失来源判为通过。

最初的一次诊断在加载器阶段拒绝了 tsx 紧凑源码，未执行 native；失败记录保留。修复将插桩定位改为 AST 结构、作用域和唯一调用检查，只在原加载文本上插入或包裹，不重打印整个模块；随后通过 raw／strip／compact 格式及真实加载链回归，并用新目录重新正式采集。Rust v8 addon 已重新构建，60 份构建输入、正式采集的 390 份源码和 842 份声明 helper 身份均保持一致。

独立复核重算 134 份编译产物、31 份语义产物、390 份源码、842 份 helper、60 份构建输入及两份构建输出，并校验进程退出与跨轮逐字对照；现有来源／语义校验器另在保存产物上静态重放，不是独立重写的 oracle。另一复核直接消费实际 map 分段和原文 UTF-16 位置，该复核者此前参与来源捕获实现。新多来源 stage map 会被旧单来源门禁提前拒绝，不能把差异总数下降或旧越界项不再进入细查当作修复；最终双侧 unmapped 减少 88、来源差异增加 88，正是新增 callee 来源与 JS 空映射不同。

342 项工具测试、脚本 TypeScript、ESLint 通过。Rust 先通过 84 项阶段测试，新增两项测试后通过 8 项来源测试；组合实验 feature 的 cargo check 与 rustfmt 通过。新增及修改实现均小于 300 行。无生产入口、公开配置或运行时行为变化，不新增 changeset／脚手架 bump；保留 pre-commit 和 lint-staged。

这只解决直接 callee 的 token 起点；参数、class/key、包装代码、其他模板 token 及完整字符区间仍需真实来源关系，标点仍可能 GLB 继承。完整 SFC 传输、额外原表达式解析及 map 重建都有成本，本轮未测性能、RSS、Vite 构建／HMR或真实 Stable 微信开发者工具，未完成最终 runtime 验收。独立审计和具体身份见[模板 callee 来源证据](./2026-10-05-template-callee-origin-evidence.json)。


## 第二十六轮：基本字面量参数来源补证

本轮仍只修改显式诊断路径。在 parse hook 当场复制原始参数的类型、值、UTF-16 范围和原文，不持有可被后续改写的 AST 引用；注册后对所有参数的数量、次序、值和 token 边界做核验，并从 Babel 明确的 map 起点取得资产位置。只支持全部参数为 string／number／boolean／null 的直接调用。复杂参数、member property、类型包装或无法精确证明的改写保留 callee-only，不产生部分 fragments，也不等于强制整段 native fallback。

Rust 对 callee 与参数共用一次原表达式解析，校验来源切片和同序覆盖；生成侧解析真实资产并与现有 metadata AST 比较，只附加已证明的参数 span。合成 metadata 默认仍保持 synthetic，无 provenance 或未覆盖的资产不借用独立解析坐标。独立检查器沿实际输出 AST 的同序参数定位 token，再检查明确 map segment 与 consumer；打印器改变引号或空白不会靠猜偏移处理。重复字面量不能交换，缺失、重复、错序、半个 surrogate、坏范围与复杂参数均有负例。

本机 macOS arm64、Node 24.18.0、Rust 1.99.0 已重新构建 release addon 并复跑严格完整编译及受控行为对照。360 次 JS 完整控制逐字相同；native 的 90 次完整调用为 36 次实际 native、36 次单次 JS fallback、18 次无 stage，54 份 fallback／无 stage 输出逐字一致。受控 Node 对照仍为 4/4 通过、8/8 worker 成功。

Wevu 首页新增 4 个独立字面量参数的来源起点，阶段与最终 map 均通过；零售详情本轮新增参数数为 0，仍只覆盖其 14 个 callee。两个语料入口各重复两轮，得到每个 map 层 16 次参数检查及原有 88 次 callee 检查，不能相加当作独立覆盖。数字、布尔和 null 另有合成及 Rust 回归，不将其写为真实页面覆盖。

**严格命令实际 exit 1：`completed=true`、`semanticComparisonPassed=true`、`compilerComparisonPassed=false`、联合 `comparisonPassed=false`。** 32 项严格完整比较通过仍来自 JS fallback／无 stage；native 的 36 项严格 stage 比较全部未通过。参数来源只是额外证据，没有放宽旧 oracle、扩大生产启用范围或证明完整字符区间。

394 项工具测试、91 项 Rust 阶段测试、脚本 TypeScript／ESLint、定向 rustfmt 和三个实验 feature 的组合 cargo check 通过。60 份构建输入在构建后保持一致；正式运行前后 394 份源码、二进制和声明 helper 身份保持一致。既有三项 unused 警告仍保留。新增实现按来源摘要、Rust 校验／附加与独立 checker 拆分，所有修改实现均低于 300 行。内部诊断改动不新增 changeset 或 create-weapp-vite bump。

本轮没有性能、RSS、Vite 构建／HMR 或真实 Stable 微信开发者工具采样，仍未完成最终 runtime 验收，也没有证明整体提速门槛。新证据单独保存，不覆盖第二十五轮的固定产物和审计；摘要见[参数来源证据](./2026-10-05-template-argument-origin-evidence.json)。

独立复核重算 60 份构建输入、2 份输出、394 份源码、842 份 helper、134 份编译产物和 31 份语义产物，未见身份差异；并复核 compiler 退出 1、8 个 worker 退出 0 及各层来源计数。既有校验器在保存证据上重放，仅用于核对一致性，并非独立重写 oracle 或再次采样。审计 hash 记录在本轮参数来源摘要中。
