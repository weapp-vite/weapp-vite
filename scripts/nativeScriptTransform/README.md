# 实际 transformScript 捕获、Rust 阶段转换与打印探针

本目录包含默认关闭的兼容性实验：`check.ts` 将现有转换器已经生成的 JS 交给 Oxc 打印；`transformCheck.ts` 独立检查 Rust 对真实阶段输入的转换；`integratedCheck.ts` 在隔离进程里将 Rust 返回值实际交给完整编译器后续阶段；`semanticCheck.ts` 重跑并复核完整编译证据，再原样执行两页的 JS/native 完整脚本。Rust 包含类型清理、导入和 expose 改写、默认值、初始 data、manifest、class/key/inline 元数据与注册。这些工具均未接入生产入口，不产生性能结论；sourcemap 与未覆盖能力仍是迁移门槛。边界见 [BOUNDARY.md](./BOUNDARY.md)。

## 运行

```sh
pnpm --filter @weapp-vite/ast-native exec napi build --platform --release --features experimental-script-transform --no-js --dts target/script-transform-experiment.d.ts --output-dir ../../.codex-tmp/script-transform-native
node --import tsx scripts/nativeScriptTransform/check.ts --binding-dir=.codex-tmp/script-transform-native --output=.codex-tmp/script-transform-probe
node --import tsx scripts/nativeScriptTransform/transformCheck.ts --binding-dir=.codex-tmp/script-transform-native --output=.codex-tmp/script-transform-stage
node --import tsx scripts/nativeScriptTransform/integratedCheck.ts --binding-dir=.codex-tmp/script-transform-native --output=.codex-tmp/script-transform-integrated
node --import tsx scripts/nativeScriptTransform/semanticCheck.ts --binding-dir=.codex-tmp/script-transform-native --output=.codex-tmp/script-transform-semantic
```

输出目录必须不存在。默认任何打印结构、注释或位置检查差异都会返回失败；已知差异调查可显式传 `--allow-differences`。该参数只允许完成诊断，摘要仍保留 `comparisonPassed: false`；CI 的诊断步骤成功不表示打印器可替换现有 generator。捕获、完整产物对照、运行、清理或来源校验失败在两种模式下均失败。

## 正确性与所有权

三个独立 Node 进程串行执行同一批 45 个场景，各重复两轮：原始编译器、四项脚本优化后的 JS、同样优化并附加捕获器的 JS。完整 code、maps、warnings、错误诊断逐字比较，共 270 次检查。真实两页保留在这套语料中，没有裁掉 class、key 投影或 inline events。

捕获器安装早于原有 loader，在目标 resolve 后注册最终观察器，经 `nextLoad` 接收已有 owner 返回的优化源码。严格匹配入口、fastSetup 和 warning 三处锚点；不绕过已有 loader 或重读原文件替换其结果。每次调用保留对应 record 索引；验证连续完整覆盖、两轮重复结果，以及既有 AST transfer 与 batch owner 已清空。

原 options、warn callback、隐藏 AST transfer symbol 和返回值在真实调用中原样流转。私有记录使用 tagged tree 保存 undefined、负零、数组空洞、属性描述符；不支持的 accessor、循环数据、函数或未知 symbol 会显式失败。表达式字段分别生成源字符串并保留根 span 与身份，记录 JS generator 次数和 UTF-16 字符量。这个 bridge 有实际成本；根 span 也不能恢复所有子 token 的跨来源映射。

warning 记录区分 handler 与 console 两个观察通道；默认 handler 可能继续调用 console，因此通道数不能相加作为公开告警条数。编译器公开 warnings 仍以完整对照输出为准。

## 完整阶段实验

`transformScriptNative(source, requestJson)` 在一次 N-API 调用内解析主脚本、检查作用域并改写、生成 JS/map。主源码解析一次；模板表达式与合成片段在 Rust 内还会单独解析，不把一次跨界调用宣称为所有输入只解析一次。外层仍需 JS 表达式生成、请求编码和结果解码，当前严格适配器的重复校验也属于待计入的真实成本。

version 1 请求保留全部 26 个 options 字段的 tagged tree，表达式以 role/source/identity/root span 传入，不传 AST、callback 或 transfer token。runtime 路由和 marker 取自已有常量；私有 allowlist、installer 名称、class/style helper 与 options 标识符通过带源码 hash 的静态形状检查提取。每进程首次提取读取四份源码并解析五次，随后复用静态契约，初始化开销单独记录。

Rust 在内部有序 JSON 上只省略允许位置的 optional undefined，并返回其路径；负零、数组空洞、不可枚举 defaults 或未知字段不会被悄悄转换。app、未实现的宏、props/scoped-slot/ref/layout/CSS 注入、动态组件选项及复杂 capability 分析明确返回 unsupported。真实 Wevu 与零售页面的 class 计算、条件 key 投影、7/14 个内联事件必须全部生成，不能以回退冒充页面覆盖。

`transformNative.ts` 验证整个结果后才交付有序 warnings；unsupported、native 异常或坏 payload 可通过同阶段 JS fallback 恢复，warning callback 自身异常不会触发第二次执行。它是诊断适配器，生产编译器没有使用它。`transformCheck.ts` 在完整控制组对照后，逐条保存原始 request、native payload、预期结果、AST/注释/metadata/warnings/map 差异。回退计数表示被拒绝的独立候选，runner 并未据此证明真实编译器回退。

严格模式要求每条候选都通过；任何 unsupported 或差异都返回失败。诊断模式只允许 `completed=true` 的采集成功退出，两真实页面每轮必须 native 成功；摘要中 `nativeCompared`、`nativePassed`、fallback 与最终 `comparisonPassed` 分别保留。两份 map 各自从生成代码回查同一真实脚本来源；对称缺失映射不会自动被当作来源覆盖通过。

`record-XXXX.json` 保存逐条完整私有证据，三组 worker 报告与前后 source/binary 身份一并保留。CI 仅上传脱敏 summary。AST 相同不能替代 runtime 验收，生成的片段清空 span 也不证明来源映射等价。

## 完整编译入口实验

`integratedCheck.ts` 先运行上述三个 JS 控制组，再依次运行只透传原 JS 的入口包装器和实际 native 包装器。四组 JS 共 360 次完整输出必须逐字相同，native 组另外保存 90 次完整返回值。每条阶段记录必须与控制组的实际源码、options 描述和表达式 bridge 一致；两真实页面各两轮必须由 Rust 成功生成，所有权及前后源码、二进制身份必须一致。

native 的成功结果经完整校验后直接返回给 `compileVueFile` 或直接脚本调用者，后续 sourcemap 组合使用现有编译器工具；带真实模板来源的 native map 在诊断加载器中只对 `inline.ts` 合成主脚本 map，直接模板来源保持不变。JS 控制与回退继续调用原合成函数。unsupported 等失败只调用一次原阶段闭包，失败分支的完整产物与告警必须逐字等于 JS 控制组。loader 的加载失败、native 异常、解析错误和坏 payload 回退另有合成测试，不能把该测试覆盖称为真实宿主验证。成功路径只校验一次原始 payload，不加载完整 AST，也不调用 JS 节点回调；请求构造和告警交付成本仍属于实验链路。

`compiler-XXXX.json` 保存原输入、原始 JS 和 native 完整结果及所有差异；`stage-XXXX.json` 另查每份实际交付的 native 结果，原阶段严格 map 门槛保持不变。完整 SFC 比较独立查询两份最终 scriptMap 到原 SFC，核对 UTF-16 范围、来源内容和名称，同时保持 template、style、config、manifest、metadata、告警和错误完整对照。多来源无法绑定到本次输入、两份空映射或单侧缺失映射都不能当作来源已验证。

`completed` 仅表示诊断完整执行，`comparisonPassed` 仍要求没有回退且全部阶段及完整产物检查通过。没有丢弃 maps，也没有把去位置 AST 相等当作来源策略、运行时语义或性能通过。此实验没有运行真实微信 DevTools、构建/HMR 计时或 RSS 采样。

## 原源码位置与生成区域

native 对移动的 import 保留原 imported/local 位置。`expose` 合并为一个简写 token 时保留绑定位置与原名称，不挪到对象 key 的位置来模拟 Babel。空模板片段只在原文边界可验证时补 codegen 映射点；该准备不改变生成代码，不增加 parse/N-API 调用，但增加一次 AST 遍历与 map token 名称修复。

完整转换在 codegen 前为无主脚本来源的节点使用内部保留行，真实 span 与注释位置整体平移；Oxc 一次打印后，将保留行映射变为明确的 unmapped segment，恢复真实源行、原 sourcesContent 与有效 names。同一输出位置只保留最后一次打印标记，避免父语句与子 token 的重复映射遮蔽真实所有者。AST 坐标在退出时恢复，错误结果不交付。该路径没有新增 parse 或 N-API 调用，但有源字符串分配、AST 遍历和 map 重建成本，尚未测量净收益。

这隔离了 Oxc 实际写映射的辅助 token、注册／导出及部分容器边界；它不是每个字符的区间证明。Oxc 不写映射的逗号、分号、部分括号和 import 的 `from` 关键字仍可能 GLB 继承。没有使用 helper 名搜索生成范围，也没有把保留行作为用户源码发布。

`origins/` 现仅覆盖 `v-on` 内联表达式的直接 handler 名称：从实际 Vue 指令及原始完整 SFC 建立 occurrence，通过原 asset 的 WeakMap 保留关系，在唯一请求顶层附加 UTF-16 `provenance`。不增写生产 AST、options 或 metadata，不按相同文本搜索位置，不把生成的 `_ctx`、`_event`、参数或整个表达式标为来自该名称。只有精确原文切片、原 parser callee 与改写后根调用均可证明时才传入。

Rust 校验来源、范围和原始直接 callee AST，再沿实际 metadata 结构只给生成成员名分配位置；单次 codegen 支持主脚本与完整模板来源。`originChecks` 另从完整 SFC 解析真实 on 指令，对照实际 asset 注册顺序，并在阶段和最终产物的 callee token 上要求明确 segment 与实际 map consumer 查询同时正确。未知来源、实体解码差异、范围错误、重复或换绑均不能通过；含候选 handler 的 slot 子树目前拒绝，无事件的展示 slot 不影响当前检查。

这只是 callee token 起点的来源切片。class/key、inline 参数、包装代码和其他模板 token 仍缺乏完整来源关系，部分标点仍可 GLB 继承。严格旧 oracle 继续拒绝未核验的双侧 unmapped，独立 callee 校验通过也不消除严格编译失败。完整源码传输、上游观察、额外局部解析及多来源 map 重建的成本尚未测量。

## 打印与 map

每个成功 stage 返回的 JS 和独立语法样本都使用两种 minify 配置调用 `roundTripScriptNative`。单次 N-API 请求完成 JS parse、语义校验、codegen，返回紧凑 code/map/diagnostics，不返回 AST，也不逐节点回调。

`.ts`、`.tsx`、`.jsx` 明确 unsupported；伪装为 `.js` 的 TS/JSX 是解析错误。孤立 UTF-16 surrogate 被拒绝，合法 JS 字符串 escape 仍可保留。诊断 range 与 map 坐标按 UTF-16 检查。

打印结果的 exact code 差异、去位置 AST 结构、注释及 annotation 归属、token/identifier 映射检查分别报告。实际组合新 map 与既有 stage map，再从生成坐标查询原来源。覆盖的是探针定义的锚点，不是所有 token 末尾、断点策略或小程序 runtime。metadata 新合成表达式的来源仍需完整转换器另行解决。

`report.json`（各 worker）与 `printer-report.json` 保留私有原始源码、完整结果和 maps。公共 `summary.json` 只保留源哈希、输出摘要、检查差异和限制，不上传完整捕获源码；CI 只上传该摘要。源文件与 binary hash 在运行前后复核，不能单凭这些 hash 证明 binary 的构建来源或每个安装依赖文件。

## 完整脚本的受控行为对照

`semanticCheck.ts` 必须使用新的输出目录，并自行执行严格 `integratedCheck.ts`。父进程重放三个阶段控制组、完整 JS/native worker、全部完整与阶段 oracle，核对每页的 native 阶段结果确实进入最终 script，然后为两页各两次编译的 JS/native 分别启动新进程，共八个 worker。每个 worker 通过 `vm.SourceTextModule` 原样加载完整脚本，不删除 import、不裁剪 AST、不再次编译；未知 import/export 和动态 import 都会失败。

场景使用真实 Wevu reactivity、template helper 和 inline dispatcher，注册、平台、网络、导航与业务数据则由显式有限桩提供。检查实际 default export 身份、安装/注册/setup/expose 顺序、独立 data、manifest、flags、function prop paths、全部 7/14 个 inline handler、生成 computed 和生命周期。异步断言覆盖受控服务开始/结算、返回 Promise 的等待、加载中间态及错误保留。函数快照仅记录类型，不能替代这些实际调用与独立断言。

父进程校验原始代码 hash、实际调用账本、非空观察、断言、异步状态和进程退出码，并对原始请求/报告、编译证据、探针源码、二进制及声明 workspace helper 的 src/dist/manifest 做前后身份复核。进程级 watchdog 覆盖 VM 外的阻塞；当前 effect scope 在 dispose 中释放。完整请求、脚本、观察和子进程日志保留在私有目录；`summary.json` 为脱敏摘要。

摘要分别报告 `completed`、`semanticComparisonPassed`、`compilerComparisonPassed` 和联合 `comparisonPassed`。语义观察一致不会消除 sourcemap 失败，严格退出码仍为 1；本工具不提供 `--allow-differences`。它只覆盖这两个页面及明确的宿主 Promise/状态，不证明所有异步 continuation、完整 Wevu Component 宿主、真实微信开发者工具或性能。workspace 依赖清单也不等于所有 node_modules/Node 工具链的完整字节闭包。

## 局部检查

```sh
cargo test --locked --manifest-path packages/ast-native/Cargo.toml --features experimental-script-transform,napi/noop,napi-derive/noop script_transform
pnpm exec tsc -p scripts/nativeScriptTransform/tsconfig.json
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeScriptTransform
pnpm exec eslint scripts/nativeScriptTransform .github/workflows/ci-native-analysis.yml
```

所有新增实现按职责拆分，单文件保持 300 行以内。实验 feature 默认关闭，未改公开 TypeScript/native wrapper 或生产配置；本轮属于内部诊断工具，无 changeset 与脚手架版本联动。
