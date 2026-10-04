# transformScript Rust 实验边界

本目录已有真实请求捕获、独立 printer，以及受限的完整 Rust 脚本阶段实验。`transformScriptNative` 在一次 native 调用内执行实际类型清理、作用域改名、导入路由、组件注入和代码生成；`roundTripScriptNative` 仍只打印已经转换的 JS。完整阶段尚未通过 sourcemap 兼容门禁，且明确拒绝未覆盖选项，不能据此宣称生产替换、完整 Vue 编译器或整项目提速。

本文保留源码边界审计，并在末尾记录已经实现的范围；不是全面兼容声明。真实请求以当前运行生成的 capture 为准；下文历史产物只能证明需要覆盖的行为，不能代替当前请求、产物及性能复核。相关计时证据见 [`docs/plans/2026-10-04-script-baseline-timing-evidence.json`](../../docs/plans/2026-10-04-script-baseline-timing-evidence.json)。

## 真实入口与所有权

实际调用链在 `compileVueFile/script.ts`：`compileScript` 生成脚本、JSX 阶段按需处理后，调用 `transformScript(jsxTransformed.code, options)`，再将返回 map 与已有 script map 组合。不能用原始 `<script setup>` 文本、手工裁剪的 options 或已经转换的 JS 冒充这个输入边界。

参考：

- [`packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/script.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/script.ts)：`compileScript` 调用、`transformScript` 调用与 `composeSourceMaps`。
- [`packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts)：`transformScriptInternal` 的真实阶段顺序。
- [`packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils.ts)：`TransformScriptOptions`、`TransformResult`。

一次 native 请求应返回完整结果、有序 warnings 或明确的 unsupported 原因。调用者保留 warning callback 所有权；不传回 AST，不逐节点回调 JS。发生加载、输入校验、解析或 native 执行失败时，整次回退到现有路径。native 尚未成功交付时不重放其 warnings，避免 fallback 重复告警。native 保持可选依赖、显式启用与默认关闭。

主源码只解析一次；metadata 中不同表达式如需单独解析，也必须在同一次 native 调用内完成并单独计数。“一次跨界调用”不等于“所有输入只有一次 parse”。将现有 Babel 表达式生成字符串的 bridge 成本也必须计入实际链路，不能当作免费传输。

## 必须保留的当前语义

| 阶段 | 当前行为及迁移约束 | 源码 |
| --- | --- | --- |
| 快速路径 | `fastSetup` 位于 Babel parse 之前；实验必须记录真实 hit/miss，不得假设所有请求走相同 AST 路径 | `transformScript/index.ts`、`transformScript/fastSetup.ts` |
| 预分析 | source runtime capabilities 与 page flags 在 import 改写前收集；两者的 binding 判断并不相同 | `transformScript/runtimeCapabilities.ts`、`plugins/wevu/pageFeatures/flags.ts` |
| imports | 将受支持 API 路由到 runtime/reactivity/template 内部模块，按 imported/local 去重；保留外部 import，例如 `wevu/api` | `transformScript/imports.ts`、`scriptRuntimeImport.ts` |
| TS 清理 | 删除 enum、namespace/module、import-equals；解开类型包装；移除类型参数、annotation、optional 和 `this` 参数；parameter property 不产生构造器赋值 | `transformScript/macros/stripTypes.ts`、`transformScript/macros/optional.ts` |
| Vue 编译产物 | expose rename、空调用清理、`__name` 和 `__isScriptSetup` 清理依赖 visitor 顺序 | `transformScript/macros/setupExpose.ts`、`scriptVueSfcTransform.ts` |
| 组件选项 | 解析 object、defineComponent 和 Object.assign/引用；部分路径会 clone 对象，不能改成不同的共享/执行模型 | `scriptComponent.ts`、`transformScript/collect.ts` |
| 注入 | page marker/flags、defaults、style 分析、初始 data、props/scoped slots、CSS、manifest、computed、refs/layout、inline、function prop paths、export 依次处理 | `transformScript/rewrite/index.ts` |
| 安装与生成 | capability installer 在组件 rewrite 后注入；未 transformed 时原样返回且不强造 map | `transformScript/index.ts`、`transformScript/runtimeCapabilityInjection.ts` |

表中的 `transformScript/*`、`script*.ts` 相对目录均为 `packages-runtime/wevu-compiler/src/plugins/vue/transform/`；`plugins/wevu/*` 相对目录为 `packages-runtime/wevu-compiler/src/`。这些是实现入口，不是新增的公共 API。

特别需要回归的行为：

- 真实 Wevu 产物保留 `setup(__props, { expose }) { expose(); ... }`。`ObjectMethod` visitor 先把 `__expose` 改名为 `expose`，后续空 `__expose()` 清理规则不再匹配。Rust 不能提前删掉全部空 expose 调用。
- TS 清理不是通用 TypeScript 编译。直接换成标准 Oxc TypeScript transformer 可能给 enum、parameter property 引入目前不存在的运行时代码。
- source capability 分析使用 import binding/reference；page flags 的部分判断是名称规则。迁移不得顺便统一成另一套 shadowing 语义。
- setup 初始 data 仅从符合现有规则的可序列化初值提取；不能执行 initializer，也不能扩大对别名调用的推断。见 [`rewrite/setupInitialData.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite/setupInitialData.ts)。
- defaults 序列化会拒绝部分值并产生 warnings；对象属性顺序、重复引用和不可表示值不能经普通 JSON 传输后静默改变。见 [`rewrite/defaults.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite/defaults.ts)。
- runtime marker/helper 常量继续由 `@weapp-core/constants` 的稳定契约提供，不能在 JS 与 Rust 两侧各自扩散一份无校验的值。

## 真实两页的必要覆盖

以下事实来自固定 HEAD `2d53ed9c4c6ab0f2d0b3dae23326c94ad78213c0` 的 [run 37202918268](https://github.com/weapp-vite/weapp-vite/actions/runs/37202918268)，macOS artifact `script-baseline-timings-macos-latest` 中 `correctness/baseline.json`，对应 scenario 的 iteration 0。它是历史 correctness 输出，不是本轮完整边界 capture，也不是新性能测量。

| 观察项 | `sfc-wevu` | `sfc-retail` |
| --- | --- | --- |
| fixture | `apps/wevu-vue-demo/src/pages/index/index.vue` | `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue` |
| runtime binding manifest 记录 | 16 | 58 |
| computed | `filterList` 的循环 class | 普通 class + 受条件控制的 v-for key 投影 |
| inline event 条目 | 7 | 14 |
| function prop paths | 产物未显示该注入 | 27 |
| runtime capabilities | `required: ['inlineEvents']` | `required: ['inlineEvents']` |
| style options | `styleIsolation`、`addGlobalClass` 均 absent | 两项均 absent |
| 其他必要行为 | setup 初始 data、expose 调用、循环 scope 恢复 | setup 初始 data、page feature flags、外部业务 imports |

Retail 的 key 投影仅在 `commentsStatistics.commentCount > 0` 时求值，涉及原始列表访问、包装项、保留字段冲突 warning 和异常 fallback。将全部 class/inline metadata 判为 unsupported，只能证明回退可用，不能宣称覆盖了这两个真实输入。

本轮诊断 preflight 产生 90 个 correctness checks、72 条 stage records；其中两页各有 2 条 capture，均为 `returned`、`fastSetup: 'miss'`，每页主源码 hash 稳定且无 capture failure/warning。这尚未替代正式 runner 的三组完整 byte 对照；捕获边界与字段实现见 [`captureSource.ts`](./captureSource.ts)、[`captureTypes.ts`](./captureTypes.ts)。

| 当前捕获项 | `sfc-wevu` | `sfc-retail` |
| --- | --- | --- |
| 主源码 UTF-16 长度 / UTF-8 字节数 | 3662 / 3666 | 13054 / 13136 |
| bridge AST 字段出现次数 | 3 | 3 |
| bridge 生成源码 UTF-16 总长度 | 745 | 4870 |
| AST 引用关系 | class 表达式 1 个；list/rawList 两字段引用同一 AST | class、key 投影、condition 各 1 个 AST |
| key 投影元数据 | 无 | 投影源码 4650 字符，`forStack: []`；单个条件 `forDepth: 0`，`rawExpAst: undefined` |
| manifest features | `model`、`inlineEvents` | `functionProps`、`inlineEvents` |

两页的 `isTypeScript/isPage` 均为 true，`isApp/skipComponentTransform/relaxStructuredTypeOnlyProps/scopedSlotHostProperties` 均为 false，`classStyleRuntime` 为 `js`。defaults 均为 `{ component: { options: { virtualHost: false } } }`。`minify/sourceMap/templateComponentMeta/templateRefs/layoutHosts/autoSetDataPick/runtimeBindingManifest/pageLayout/propsAliases/propsDerivedKeys/cssModules/stabilizeCssVarsRuntime` 均为 undefined；Wevu `functionPropPaths` 为 undefined，Retail 为 27 条。当前捕获的 manifest、inline 条数及返回 capability/style metadata 与上表历史观察一致。

主源码 SHA-256 分别为 `fd6cad8f85b12ff37db23434f8d03b7bdf019864cb9d400048878cd6a8f88992`（Wevu）、`1d648f503bac47e4f20aabc708c561abaf77ef3b5188626be1107248ba0a4d5d`（Retail）。这些是实际 stage 输入的 hash，不是原始 Vue 文件的 hash。bridge 的字段次数也不是唯一 AST 数、parse 次数或跨界调用次数。options 中已有 baseline AST transfer symbol 被记录为 opaque、仍由原 loader 拥有，不能据此宣称 native 已消费或复用了它。

## 表达式传输契约

输入类型见 [`compiler/template/types.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types.ts)。每个下列 AST 字段都需要独立的表达式 role，不可压成一份字符串：

- `ClassStyleBinding.expAst`；`exp` 可能只是 `v-for :key ...` 诊断标签。
- `BindingCondition.expAst` 与 `rawExpAst`，同时保留 `forDepth` 和条件顺序。
- `ForParseResult.listExpAst`、`rawListExpAst`、`projectedListExpAst`，同时保留 loop 的 item/index/key 和缺失值。
- `TemplateRefBinding.expAst`。
- inline 的 `expression`、`parameterNames`、`scopeKeys`、`indexBindings`、`scopeResolvers`，包括 resolver 按 scope key 排列和缺失时的 undefined。

原始/投影表达式产生于 [`compiler/template/conditions.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/conditions.ts) 和 [`compiler/template/elements/tag-structural.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/elements/tag-structural.ts)。它们已带有上游 `this`、props、unref、循环项访问改写；native 不得从显示用 `exp/listExp` 重做归一化，也不得对捕获字符串统一再做一次 free-name 到 `this` 的改写。

`classStyleComputedBuilders.ts` 的 `buildForExpression` 按 `forDepth` 在进入对应循环前求条件；key 投影选择 raw 条件/列表，普通 computed 选择 projected 列表。数组、对象、数字列表的 alias、返回形状和异常日志各有分支。参考 [`classStyleComputedBuilders.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/classStyleComputedBuilders.ts)。

另一个作用域边界在 [`classStyleComputed.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/classStyleComputed.ts)：当前 propsAliases 只对 `binding.expAst` 单独建 program 做 free-reference rewrite，不处理条件/列表，也没有把 forStack 当作该次 traversal 的 lexical bindings。native 若合并所有外部作用域，会改变基线。生成 computed 的外层普通函数和内层箭头函数也必须保留各自的 `this` 绑定。

inline map 注入和 methods 合并规则见 [`rewrite/inlineExpressions.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite/inlineExpressions.ts)。key 投影 AST 已由上游构造，首版完整阶段可解析其捕获源码并注入，无需在同一实验中重写整个模板编译器。

## map 与注释的证据边界

当前 Babel generator 在非 minify 时使用 `retainLines`，源名称是 `inline.ts`。Oxc 重打印改变 generated 坐标后，旧 map 不能原样附在新 code 上；应生成新 output 到原 input 的 map，再按真实链路组合。组合实现见 [`packages-runtime/wevu-compiler/src/utils/sourcemap.ts`](../../packages-runtime/wevu-compiler/src/utils/sourcemap.ts)。

`generatedSource` 与表达式根节点的 `originalSpan` 不足以恢复所有子 token 的来源。当前表达式 parser 解析的是独立 `(${exp})` 文本，见 [`compiler/template/expression/parse.ts`](../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/parse.ts)；其位置不能假定为 script 或 SFC 偏移。表达式改写后可能混合原始节点、别名节点和无位置的合成节点。完整迁移需要可组合的 token provenance/表达式 map，或明确的合成区间规则及对应 oracle。

对上节固定历史产物进行 GLB 查询时，观察到：

| 产物 token | 最终 map 观察 |
| --- | --- |
| Wevu computed 内首个 `filter.key`、`activeCategory` | 没有原始来源 |
| Retail computed 内首个 `commentsStatistics`、`commentItem.goodsSpu` | 没有原始来源 |
| Wevu 用户函数 `groupByCategory` | 映回该 Vue 文件第 25 行 |
| Retail 用户函数 `selectSpecsName` | 映回该 Vue 文件第 184 行 |
| Wevu 生成的 `expose()` | GLB 继承到原 Vue 第 22 行的 ref 声明位置 |

这些观察描述现有 map，不代表其每个映射都理想。修正历史映射行为必须单独报告，不能作为 printer 等价性被隐藏。

空 span 只能阻止为该节点新增映射，不能自动证明整个生成区间 unmapped；同一行查询仍可能继承前一个 import/token 的映射。尤其要检查 minify 后原始与合成代码相邻的情况。不能用“不 panic”“map JSON 合法”“sourcesContent 相同”替代断点来源检查。

printer oracle 应分别报告：

1. 完整 code/map/warnings 的严格差异，不把格式差异从原有 byte oracle 中删除。
2. 去除位置信息后的 AST 结构；保留 directive、表达式和声明差异。
3. 注释文本与顺序，以及 PURE 等 annotation 的目标表达式归属；仅比较注释文本不足以证明 bundler 行为不变。
4. 标识符、字面量、边界及 unmapped 区间的实际位置查询，包含 UTF-16、CRLF、TS 擦除、rename、minify 和跨 source 组合。

标识符起点对齐只是其中一项。组合测试必须实际生成 composed map，再从最终 generated 坐标查询；在已判定两坐标相等后，对同一个 upstream map 查询两遍，不能独立证明 composition。完整转换还需验证 metadata 来源，printer probe 输入已完成转换，因此不覆盖这项所有权迁移。

## 可执行的完整阶段路线

建议分为 `contract`、`facts`、`source`、`component`、`expressions`、`emit` 模块。先预检请求，解析主源码并收集 owned semantic facts，再按现有顺序改写。成功后返回最终 code/map/metadata/warnings；unsupported 保留稳定原因，不返回部分转换结果。

Oxc 0.152 API 使用 AST 类型上的构造方法，例如 `Statement::new_import_declaration`、`Statement::new_export_default_declaration` 和 `Expression::new_object_expression`，传入 `oxc_ast::builder::AstBuilder`。旧版 `builder.expression_*` 示例不可直接复用。容器使用 `ArenaVec`；移除/展开 statement 可集中在 `VisitMut::visit_statements`，类型包装可用 `ReplaceWith::replace_with` 处理。版本基线见 [`packages/ast-native/Cargo.toml`](../../packages/ast-native/Cargo.toml)。

若分析依赖父节点表，`SemanticBuilder` 要显式启用 `with_build_nodes(true)`。结构改写前提取 owned facts、释放 semantic 对原 AST 的借用；新建节点的 dummy IDs 和 clone 后的 semantic IDs 不能当作原来的 binding/reference。TypeScript 参数、optional chain 等 AST 形状也必须按 Oxc 0.152 处理，不能套用 Babel node 形状。

首版可保守回退尚未实现的 App、decorator、复杂动态选项、layout/template refs/CSS modules 或不可无损传输的输入；但必须用当前 capture 确认这些不是目标两页的必需能力。每个 fallback 都要有回归，且成功路径仍需完整覆盖两页 class、key 投影和 inline events。

构建期语义 oracle 可在受控 Node module harness 中分别运行旧、新完整输出，使用一致的确定性 import stubs，记录 installer、组件注册、setup、expose、lifecycle 顺序；比较初始 data、manifest、flags、functionPropPaths；调用 computed 和所有 inline handler 检查结果、参数、scope resolver、异常日志与异步行为。特别覆盖数组/对象/数字循环、关闭条件不求值、投影保留字段冲突、props/state 同名与局部 shadowing。

以上受控 harness 现由 `semanticCheck.ts` 与 `semantic/` 实现，原样执行完整编译返回的 ESM，并通过真实 helper 与有限宿主桩验证这两页的确定性行为。每个 handler 的实际调用次数、computed/lifecycle 调用账本、独立断言和异步结算顺序均需通过；相同的失败或空观察不能成为成功。对受控宿主 Promise 的观测不等于追踪所有脱离调用链的 continuation。

该 harness 不是小程序生产代码，也不能替代后续真实 runtime E2E。扩大 native 覆盖前仍需真实编译入口的配对采样、包重建后的串行下游验证和跨平台证据。性能判断沿用既定门槛，不能由 printer micro benchmark 推断整链收益。


## 已实现范围与仍未满足的门槛

阶段实现位于 `packages/ast-native/src/script_transform/{request*,rewrite,metadata,component_*,capabilities,transform}`。主脚本有一个 Oxc AST；模板表达式和合成片段在 Rust 内解析后加入该树。setup 初值直接 clone 原节点，保留其 span；新片段清空 span，不能将独立表达式位置冒充脚本位置。

已有显式拒绝覆盖 app、未实现的 Vue/Wevu 宏、非空 propsAliases/propsDerivedKeys、scoped slots、template refs/layout/CSS、复杂 component/capability shape 等。自定义 TS 删除、expose 的 visitor 顺序、显式 this 参数和类型/值命名空间分别有当前 TypeScript 实现的直接 oracle 回归。请求层保持字段顺序与 undefined 描述，private helper/routes 从现有源码提取，避免 Rust 静默维护另一套常量。

独立阶段检查先比较原始、优化 JS、附加 capture 的完整编译返回值，再把完整真实阶段输入交给 Rust。[10 月 4 日阶段证据](../../docs/plans/2026-10-04-script-transform-stage-evidence.json) 仅覆盖这一边界，当时没有回灌完整编译器。

新增 `integratedCheck.ts` 在隔离的完整编译调用中返回 native 的 code/map/metadata，让后续阶段实际组合 map；同时验证真实 JS fallback 一次执行和告警交付。四个 JS 控制组仍完整逐字对照，所有 native 完整返回值与实际阶段返回值分别保存并严格检查。生产入口仍未安装该 loader，没有运行时 E2E 或性能样本。strict 模式不接受 fallback 或 map 差异，诊断完成与语义门禁分别记录；通过 AST 或完整控制组对照不能替代来源契约。

原主源码的 import 位置和改名前名称现在随变换保留；空模板片段在真实边界上补映射。`expose` 简写用原绑定位置，非空 quasi 用真实内容起点，仍可能不同于 Babel。完整转换的 provenance 包装器利用 Oxc 自己的打印位置，在无主脚本来源的映射点发出 unmapped segment，覆盖辅助 token、注册／导出及部分容器关闭点。Oxc 不发映射的部分标点及 import 的 `from` 关键字仍可能继承前一真实节点的位置；不能将 token 起点覆盖描述成完整字符区间隔离。

模板 metadata 的根 span 与字符串不能证明逐 token 来源。上游模板 AST 尚有真实 Vue loc，但字符串进入表达式工具后会 trim、规范化，再独立解析 `(${exp})`。内联表达式还经过 stringify 和重新解析；按表达式文本缓存的 AST 可被多个出现位置共享。旧表达式请求保留角色及生成源码，片段解析后的 span 清空是避免混用坐标所必需的保护，不能直接恢复根 span 来绕过它。新增可选 `provenance` 旁表只给实际 `v-on` 直接 callee 建立完整 SFC owner、独立 occurrence 与原 UTF-16 切片；在真实资产对象上关联来源，并在 Rust 中仅映射改写后的成员名。

后续完整来源契约仍需从持有 Vue loc 的上游逐项扩展：

1. 每次编译建立不可变 source owner，保留来源标识、精确内容 hash、UTF-16 长度；每个表达式出现位置有独立 occurrence ID 与原始 slice。共享缓存只能保存局部、无 owner 的解析结果。
2. trim、实体解码、换行、wrapper 与 AST 改写各自保留可组合的坐标关系；clone/replace 保留真实子节点来源，新增辅助节点明确记录 generated，无法证明的节点保留 unknown。
3. inline asset、class/style、条件与循环元数据用稳定 fragment 引用关联 sidecar，一次批量传递去重后的 source/fragment；Rust 将独立片段坐标绑定到各自来源，不能全部当作主脚本或纯生成片段。
4. 从节点构造和打印过程取得独立输出位置证据，再核验最终 map。只有该证据证明精确 anchor 为 generated，双侧 unmapped 才可按明确策略接受；AST 相似、源码文字搜索和被测 map 自身都不能替代所有权证据。

上述完整路线尚未实现。目前只验证直接 handler callee 的起点：独立 SFC parser 与实际资产顺序校验原始 occurrence，metadata AST 路径定位输出 token，显式 map segment 与真实 consumer 同时核对原始来源。诊断加载器只合成 native map 中的 `inline.ts`，保留直接模板来源；JS 控制路径仍逐字对照。其他 token 与变换继续保留未验证状态，不改变当前严格 oracle 以追求通过率。

后续需要先完成主源码与合成区间的来源策略、保留必要注释，并通过完整编译/真实宿主验证，再决定是否进行正式配对计时。不能通过丢掉 maps、只比较裁剪页面、仅跑返回成功或弱化 AST oracle 来扩大实验覆盖。
