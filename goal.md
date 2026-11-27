# native 模式：目标与思路

`weapp.appPrelude.mode: 'native'` 是 Web Runtime 全局对象注入的第四种模式，思路取自 babel-plugin-polyfill-corejs3，把它的 `usage-pure` 与 `usage-global` 合进一个模式：

- **自由标识符与点号全局访问（usage-pure）**：源码里裸用的 `fetch`、`URL`，以及 `globalThis.fetch`、`window?.URL` 等全局对象点号访问，由 Rolldown 原生 `transform.inject` 在构建期精确绑定到对应实现模块，按需导入、不写全局、可被 tree-shake；局部同名遮蔽仍由 Rolldown 保留。
- **不可点号注入的显式全局语义（usage-global）**：`globalThis['fetch']` 等字符串计算属性、全局解构与 `const host = globalThis; host.fetch` 别名，按目标生成幂等桥接模块，只在宿主缺失或仅有占位实现时写入。
- **静态盲区**：无法静态推断的动态 key 或间接访问用 `globalTargets` 显式声明，由根入口静态依赖桥接在启动期精确安装。

这样就不必像 `inline`、`entry`、`require` 那样依赖“安装器先于业务代码执行”的顺序：那三种模式靠入口前置注入安装脚本兜底，执行顺序变化（分包冷启动、懒加载、独立分包、HMR 重排）时注入可能失效，还会把大量未用实现整体装进来导致体积偏大，不少库（例如 axios 的环境模块）更要专门的产物补丁。native 用构建期精确匹配把这些代价收敛掉，且不引入任何 `installWebRuntimeXXX` 安装入口、不按依赖名匹配、不生成 axios 环境模块或 bundle 补丁；旧三种模式的默认行为保持不变。

**配置面收敛为精确最优解，无策略开关**：native 行为固定（自由标识符与点号全局访问精确绑定 + 不可注入的显式全局语义按目标桥接 + 打包器自然分包），用户只用 `targets` 选择绑定资格、`globalTargets` 精确补充隐藏访问。全量安装未用实现会破坏 tree-shaking，与精确目标相悖，因此不提供这类开关。

收益（同一 fixture 实测）：构建更快（未压缩单次交替测量约 −30%）、匹配更准（引用才进包，默认零多余全局写入）、产物更小（对照 `require` 未压缩小 8.52%、压缩小 11.30%）。

## 架构与实现

- **虚拟模块**：`virtual:weapp-vite-web-runtime:bindings` 转发真实实现导入；自由标识符与 `globalThis.<target>` 等点号访问共用 Rolldown `transform.inject` 精确绑定；`virtual:weapp-vite-web-runtime:global:<target>` 只服务不可点号注入的显式全局语义；自定义 App Prelude 作为普通静态模块执行并参与同一套精确绑定，根入口先求值 `globalTargets` 桥接、再运行 prelude，保证动态全局读取在启动时已就绪；不再生成 `app.prelude.js`。
- **单一真源**：`resolveInjectRequestGlobalsOptions` 的 native 分支固定返回精确行为（无入口前置安装时机），`globalTargets` 只收声明目标；依赖展开（`URL`/`URLSearchParams`/`Blob`/`File`/`FormData`）由注入计划在同一集合上补齐，下游注入与分组自动跟随。
- **写入条件共享**：桥接调用 `@wevu/web-apis/runtime` 的 `shouldInstallWebRuntimeGlobal`（缺失或带占位标记 `__rp` 才写），与安装器共用同一份占位规则；桥接只保留字面量 `Reflect.get`/`Reflect.set`，写入包进 `try/catch`，宿主冻结/不可写时保留原值、不中断入口。
- **模块归属**：按 `@wevu/web-apis/runtime` 的**打包器解析**包根识别实现模块（前缀匹配，Windows 折叠大小写与分隔符），与模块图同基准；Node 解析仅 fallback。解析根由每个 core plugin 实例持有，并发构建互不覆盖；不用路径子串猜测。
- **产物拆分**：绑定、桥接与实现的分包交给打包器自然分组，不强制额外 vendor。仅保留一条 Rolldown `codeSplitting.groups` 规则把自定义 App Prelude 独立成 `weapp-vendors/web-runtime-app-prelude.js`，优先级 `NATIVE_APP_PRELUDE_CHUNK_PRIORITY = 91`，并有 `> 0` 的不变量用例。独立分包保留自己构建根内的实现，不跨包引用主包 vendor。
- **共享契约**：`WEB_RUNTIME_GLOBAL_INSTALL_PREDICATE` 与 `WEB_RUNTIME_DERIVED_GLOBAL_TARGETS` 放在 `@weapp-core/constants`，公开配置类型由常量派生，web-apis 侧有“导出名 == 常量”的契约用例。

## 配置面

- `targets`：精确绑定的**资格集合**（opt-out 作用域），默认全部允许目标。它决定哪些自由标识符与全局对象点号访问会被绑定到实现，而非直接决定产物体积——实际进包量由 tree-shake 按真实引用裁剪。把某目标移出 `targets`，其裸标识符与点号全局访问不再被绑定，回落到运行时全局。
- `globalTargets`：补充静态推断不到的隐藏访问；接受基础目标与依赖展开目标（`URL`/`URLSearchParams`/`Blob`/`File`/`FormData`）。**独立于 `targets` 绑定资格**——收窄 `targets` 不会裁剪声明的目标。安装范围是**声明目标 + 其必要依赖闭包**（如声明 `fetch` 会一并装上它依赖的 `URL`/`TextEncoder` 等），而非仅字面声明的那一个全局，也不会全量安装与声明无关的未用实现。声明的目标由根入口（含各分包根）静态依赖桥接，启动期安装。
- `dependencies`：native 不参与（类型上 `never`），只影响旧模式的自动规则。
- 无策略开关：安装范围与分包都固定为精确最优解。

## 与三种旧模式的差距及处置

1. **宿主占位实现**：已覆盖。共享判定替换占位值、保留真实宿主实现；emit 级用例覆盖“占位被替换、真实现不被覆盖”。自由标识符与 `globalThis.<target>` 点号访问由 `transform.inject` 绑定到我们的完整实现，宿主完不完整都不影响——这两条主路径没有差距。窄边界只存在于仍走桥接的访问形式（如 `globalTargets`、`globalThis['Headers']` 或全局别名）：宿主已有真实但不完整的实现（非 null、非占位，如缺 `getSetCookie`）时，旧 installer 会补丁宿主原型，native 桥接按“宿主优先”保留原值。小程序宿主通常没有 `Headers`（null→直接装完整实现），此边界很少触发；要覆盖它需把逐目标补丁逻辑搬进通用桥接，违背“无 installer、生成代码最小”的目标，故作为宿主优先语义下的已知边界保留，而非普遍差距。
2. **静态盲区**：设计取舍，不做启发式猜测。出口是 `globalTargets` 精确补充。
3. **“写全局替换实现”的扩展点**：设计取舍，精确绑定优先。若某目标必须跟着全局走，把它从 `targets` 去掉（裸标识符与点号全局访问回到运行时全局），并按需声明 `globalTargets`。
4. **依赖 Rolldown 原生 `transform.inject`**：接受。weapp-vite 内部无差异；脱离该管线时 native 不可用。构建环境必须能解析 `@wevu/web-apis`，失败直接报错，不静默降级。
5. **`dependencies` 不参与**：接受，见配置面。
6. **覆盖与排查**：构建侧有 ES5/压缩契约；运行期有默认态 headless 用例；真实 DevTools 尚未跑通。产物无 installer 标记，排查依赖绑定/桥接模块与 app-prelude vendor。

## 既定取舍与已知限制

- **失败隔离**：全局写入有 `try/catch` 隔离（宿主拒绝写入不中断入口）；但实现模块自身加载失败仍会让整条入口失败——精确绑定模式选择显式失败而非静默跳过。
- **打包器耦合**：app-prelude 分组规则依赖 Rolldown `codeSplitting.groups` 语义，升级时按优先级不变量用例复验。
- **matcher 解析基准**：实现包根优先用**打包器解析**结果（plugin `resolveId` 里 `this.resolve('@wevu/web-apis/runtime', …, { skipSelf: true })` 捕获），与模块图同基准，alias/自定义 resolver 下不漏收；Node `import.meta.resolve` 仅作 fallback。捕获值按 core plugin 实例隔离，不依赖构建串行；不用路径子串猜测，也不加“产物必须含某 vendor”的守卫（独立分包与增量 bundle 本就可能没有该 vendor，会误伤合法场景）。
- **DOM 验收 provider 范围**：analyzer 把跨多个 case 使用的 `process.env` 模式守卫视为不确定（既定语义 uncertain→undefined），复合 `skipIf` 会被计划进所有 provider。native 的 devtools/headless case 因此只用纯 provider 守卫，模式由 case 内部 `launchMode` 选择；代价是这两个 case 会在各自 provider 的所有模式任务里运行（冗余但正确）。改 analyzer 支持复合守卫会与“多次使用即不确定”启发式冲突且影响面广，未采用。
- **ES5 兼容是语法层，宿主全局前提与旧模式相同**：桥接用 `Reflect.get/set(globalThis, …)`，ES5 转译只去掉 `=>`/`const`/`let`，`globalThis`/`Reflect` 这类 ES6+ 全局转译不掉。旧 installer 与 passive bindings 本就依赖 `globalThis`/`Reflect.construct`，native 没有引入新的宿主全局要求；但这些全局在 AppService 真实存在，最终要靠 Stable runtime 验收证明（见未闭合事项 1）。
- **host-first 跨 HMR 会保留自己上一轮的安装**：共享判定保留任何真实实现（含我们上一轮装的全局）。HMR 全量重载后，自由标识符与点号全局访问都重新绑定到**新**实现模块，而仍走桥接的 `globalThis[target]` 因已是真实实现跳过写入、停在**旧**实例；只有实现模块本身在 HMR 中变化时，精确绑定与桥接全局才会分叉。实践中变的是业务代码、实现模块极少变，故罕见；这是 host-first + 幂等的真实语义后果，非缺陷。
- **用户 dotted-only 覆盖的不对称**：用户覆盖 `fetch` 会同步到 `globalThis.fetch`、`window.fetch` 等点号键（一致）；只覆盖 `globalThis.fetch` 时，自由 `fetch` 与其他全局对象点号访问仍用默认实现，`fetch()` 与 `globalThis.fetch()` 分叉。这是用户显式选择（dotted 键更具体）的结果，语义上成立，属需要说明的不对称。
- **精确性依赖实现模块无副作用**：带 `networkDefaults` 时绑定模块有 `setMiniProgramNetworkDefaults` 副作用调用，但未用实现仍被 tree-shake（nativeSize 带 networkDefaults 的 fixture 可证），因为各实现模块本身纯。若将来某实现模块引入副作用，精确性会退化——这是需要守护的隐含不变量。

## 验证

- `pnpm --filter weapp-vite typecheck`：0 错误；`test:types`（16 组 tsd）：通过。
- 定向单测：resolver、注入计划、`emit/requestGlobals/**`、`emit.more`、模块归属 matcher、派生目标声明、load 契约、分组优先级不变量、冻结全局隔离、共享判定契约、DOM provider 范围与 nativeSize tree-shaking 合并运行 402 例 / 20 文件通过。globalThis 点号访问调整后，requestGlobals 相关 17 文件 / 223 例，以及 transform/load/nativeSize 等 7 文件 / 179 例分别复跑通过；nativeSize 用例确认未用 Web API 被 tree-shake、点号全局访问不生成桥接、显式全局桥接按目标裁剪。
- 构建产物（直连 CLI 构建 `e2e-apps/app-prelude-native` fixture 核对）：精确安装 13 个全局目标（`globalTargets` 的 fetch/Request/Response + 依赖展开 + 源码显式 `globalThis` 引用），未声明未引用的 `XMLHttpRequest`/`WebSocket`/`EventSource` 全程模块内、无全局写入；无额外强制 vendor；自定义 App Prelude 独立成 `weapp-vendors/web-runtime-app-prelude.js` 且含 `runAppPrelude`，根入口依赖它、它不反向依赖入口，独立分包自包含不跨包引用主包 vendor。ES5+压缩变体含全局写入的产物无 `=>`/`const`/`let`；全产物无 `installWebRuntime|axiosEnv|eagerBindings|__wvAXFE__`。
- 体积（同一 fixture）：`require` 918,884 / 744,175 B（12 文件）；native 精确 840,582 / 660,119 B（11 文件）。
- `e2e/ci` 构建契约锁定精确语义（独立 app-prelude vendor 用例 + 精确桥接 ES5 用例），上述直连构建即按其断言逐项核对；正式 vitest 套件复跑因跨 worktree 机器租约阻塞（另一 worktree 残留未终结 scope，约定先不动）顺延到 PR CI。`ide-headless-full` runtime 本地通过。
- 发布策略：`@weapp-core/constants` 升级同步所有公开直接依赖者 patch changeset（8 个包）；changeset 首行含 Conventional 类型；policy 检查通过。

## 未闭合事项与后续

1. **真实 DevTools runtime 验收**（唯一硬缺口）：本机只有 nightly 通道，其 automator / runtime log 在预算内不就绪；nightly 不能替代 Stable 验收。
2. **native 运行时 ES5 用例**：目前只有构建契约，运行期仅默认态 headless。
3. **宿主不完整实现的桥接访问**：窄边界、宿主优先的有意取舍（自由标识符与点号全局访问不受影响）；是否要像旧 installer 那样补丁宿主原型待定。
4. **打包器分组语义升级**时的契约复验。