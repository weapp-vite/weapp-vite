# Web Runtime `native` 模式目标审计

- 审计日期：2026-11-25（本轮为 hybrid 收敛后的复核，替换同日基于旧实现的结论）；2026-11-26 先追加 native `prelude` 纯拆分增量，随后把该开关改为“安装范围 + 产物拆分”双重语义，本轮数字与结论已按新契约重测，见 5.2、6、9.1 与 10.3
- 审计对象：当前工作树中的 `weapp.appPrelude.mode: 'native'` 实现
- 审计方式：源码、单元测试、CI 构建契约、headless runtime、真实构建产物与同条件体积对照、本机微信开发者工具安装盘点
- 验收状态：**未完成真实 WeChat DevTools Stable runtime 最终验收**（本机没有 Stable 安装，见第 10.2 节）。本轮 `prelude` 契约变更后的 CI/headless 复跑被第 10.3 节记录的机器租约阻塞，尚未在新代码上重跑；已完成的证据是同条件直连构建产物与包级单元测试，旧契约下的 headless 复跑结果不能当作本轮通过证据沿用。

## 1. 结论摘要

`native` 现在的行为是固定的 hybrid：自由标识符走 Rolldown 原生 `transform.inject`，明确的全局访问走按目标裁剪的幂等桥接模块。本轮复核确认以下目标已经满足：

- 不生成也不调用 `installWebRuntime*`、eager installer context、finalizer。
- 不读取依赖包名，没有 `dependencies` 配置，也没有 axios 环境模块或 `__wvAXFE__` 这类产物补丁。
- 不提供策略选项；`native` 下自定义 App Prelude 只是一个普通静态模块。`appPrelude.webRuntime.prelude` 在该模式下同时控制安装范围与产物拆分：默认 `false` 只为显式全局访问与 `globalTargets` 涉及的目标写入全局、拆分交给打包器，`true` 时把本轮全部绑定目标安装到 `globalThis` 并用一条 Rolldown 原生分组规则把绑定、桥接与实现拆进独立 vendor chunk。两种取值都不引入安装时机语义。
- 点号访问、字符串中括号、可选访问、全局对象解构和 `window` / `self` / `global` 别名都能生效，并且只为真正涉及的目标写入全局，宿主已有能力优先。
- 只写 `weapp.appPrelude.mode: 'native'` 就能启用全部 22 个目标（实测解析结果 `targets: 22`、`native: true`、`prelude: false`），无需再写 `webRuntime`，也无需 `dependencies`；同样配置下旧 `require` 模式解析为 `null`，即 native 的默认覆盖面比旧模式更宽。
- 同条件对照构建中，`native` 产物体积小于 `require`：未压缩少 8.52%，压缩后少 11.30%；未压缩构建耗时约低三成。开启 native 的 `prelude: true`（全量安装 + shim 拆分）后，相对 `require` 仍有未压缩 7.37%、压缩 10.07% 的净收益，但相对默认 native 分别增加 1.25% / 1.37%——多出的 14 个目标桥接不再由源码引用裁剪。

剩余边界：

- 无法静态推断的动态 key 与间接别名必须显式声明 `globalTargets`；native 的桥接只覆盖可静态识别的全局读取，这是精确绑定模型的固有边界，不是缺陷。
- 运行期改写或删除 `globalThis.<target>` 的副作用语义仍属旧模式（见第 8.2 节）。
- 本轮契约变更后的 CI 构建契约与 headless runtime 复跑被第 10.3 节记录的机器租约阻塞，尚未在新代码上重跑；本报告对新契约的产物证据来自同条件直连构建与包级单测，旧契约下的 CI/headless 通过记录保留在第 9.2 节，不套用为本轮结论。

真实 DevTools Stable runtime 尚未执行，因此本报告不能视为最终验收通过。

## 2. 逐项目标判定

| 目标 | 判定 | 证据与边界 |
| --- | --- | --- |
| 类似 Babel transform-runtime 的精确注入 | 满足 | Rolldown `transform.inject` 负责自由标识符；binding 模块只 import/re-export 实现。 |
| 覆盖全部 Web Runtime polyfill | 满足 | 22 个公开目标 + 5 个 URL/二进制内部目标 = 27，与 `packages-runtime/web-apis/src/runtime.ts` 导出集合一致。 |
| 不需要 `installWebRuntimeXXX` | 满足 | 新鲜 native 产物扫描 `installWebRuntime\|axiosEnv\|eagerBindings\|__wvAXFE__` 命中 0 个文件。 |
| 不需要 `dependencies` | 满足 | native 分支不读取依赖包名；`mode: 'native'` 单独即启用全部目标，依赖表中增删 `axios` 后解析出的目标集合完全一致。 |
| 不需要按库特例（含 axios） | 满足 | axios 没有专用分支，只从它真实使用的全局读取获得 `fetch`、`URL` 两个桥接。 |
| 完全使用 Rolldown/Vite 原生能力 | 满足 | 注入、虚拟模块解析、模块图依赖与 tree-shaking 全部走原生链路；产物写出由 Vite/Rolldown emit/write 负责。 |
| 覆盖显式全局语义 | 满足 | 目标级幂等桥接覆盖点号、中括号字符串、可选访问、解构与别名，并排除局部遮蔽。 |
| 完全替代 `inline \| entry \| require` | 部分满足 | 仅静态不可推断的访问需要 `globalTargets`；运行期改写全局、删除全局等副作用语义仍属旧模式。 |
| 更高性能 | 构建侧满足 | 去掉 installer 循环、全量全局写入与逐模块旧源码扫描；同一 fixture 预热两轮构建耗时 native 3,626/3,678 ms 对 `require` 5,290/5,301 ms，约低 31%。真实 DevTools 冷启动耗时未测量。 |
| 更小体积 | 满足 | 同一 fixture 对照：未压缩 918,884 B → 840,582 B，压缩 744,175 B → 660,119 B。 |
| Prelude 仅承担普通模块职责 | 满足 | native 不再用 Prelude 做 Web Runtime 启动协调，无 eager 锚点；自定义 Prelude 是带一次性守卫的普通导出模块。`appPrelude.webRuntime.prelude: true` 注册一条 Rolldown 分组规则把绑定/桥接/实现拆成独立 vendor，同时将安装范围扩到本轮全部绑定目标；求值顺序仍只由普通模块依赖决定。 |

## 3. hybrid 实现

核心实现位于：

- [nativeInject.ts](../../packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals/nativeInject.ts)：注入映射、binding 与桥接模块代码。
- [injectRequestGlobals.ts](../../packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals.ts)：目标解析、`resolveNativeGlobalTargets` 静态全局分析、native 跳过依赖包名匹配。
- [load/options.ts](../../packages/weapp-vite/src/plugins/core/lifecycle/load/options.ts)：把注入映射接入每个入口的构建选项。
- [appPrelude.ts](../../packages/weapp-vite/src/plugins/core/lifecycle/emit/appPrelude.ts)：native 下 Prelude 作为普通导出模块生成。

自由标识符只做精确绑定，不写全局：

```ts
fetch: ['virtual:weapp-vite-web-runtime:bindings', 'fetch']
```

显式全局访问按目标建立桥接，宿主已有能力优先、缺失时才写入，模块缓存保证同一目标只安装一次：

```js
const current = Reflect.get(globalThis, 'fetch')
if (current == null) Reflect.set(globalThis, 'fetch', binding)
```

用户 `build.rolldownOptions.transform.inject` 覆盖始终最优先：自由标识符覆盖会同步到对应的 dotted 键，显式 dotted 覆盖还供桥接模块复用；基础 binding 不反向导入 override，避免 override 模块读取其他目标时形成循环。

### 3.1 产物中的实际形态

以 `e2e-apps/app-prelude-native` 的 native 构建（22 个目标 + `globalTargets: ['fetch', 'Request', 'Response']` + 网络默认值）为例：

| 产物 | `Reflect.set(globalThis, ...)` 桥接目标数 |
| --- | ---: |
| `dist/app.js` | 11 |
| `dist/subpackages/independent/pages/entry/index.js` | 13 |
| `dist/weapp-vendors/common.js`（axios 闭包） | 2（`fetch`、`URL`） |

- 自定义 Prelude 落在 `dist/weapp-vendors/web-runtime-app-prelude.js`，导出 `runAppPrelude()`，内部用 `globalThis.__ai` 守卫保证一次执行；独立分包入口内联同一份实现，靠同一守卫保持单次副作用。
- 全量 emitted JS 中 `installWebRuntime`、`axiosEnv`、`eagerBindings`、`__wvAXFE__` 命中 0 个文件。
- `__weappViteWebRuntimePreludeState__` 只出现在 fixture 自己的 `src/app.prelude.ts` 读取处，框架 native 路径不再写这个锚点。

chunk 文件名与合包结果随共享策略和压缩配置变化，不构成契约；`e2e/ci/app-prelude-native.build.test.ts` 按模块依赖闭包而不是固定文件名做断言。

## 4. 启用条件与消费者依赖

最小配置：

```ts
weapp: {
  appPrelude: {
    mode: 'native',
  },
}
```

实测解析结果为 `{ mode: 'explicit', native: true, prelude: false, targets: 22 }`，即只选模式就启用全部允许目标；`targets`、`globalTargets` 与 `networkDefaults` 通过 `appPrelude.webRuntime` 收窄或补充，顶层 `weapp.injectWebRuntimeGlobals` 与已废弃的 `weapp.injectRequestGlobals` 作为兼容入口同样可用；`webRuntime: false` 或 `appPrelude.enabled: false` 可关闭。

- 消费者不需要额外安装 polyfill 包：`weapp-vite` 自带 `@wevu/web-apis` 依赖并发布 `weapp-vite/web-apis/runtime` 入口，emitted JS 里没有未解析的 `weapp-vite/web-apis` 或 `@wevu/web-apis` 导入。
- 启用后写入全局的数量仍由业务代码决定：只使用自由标识符时不写全局，只有静态识别到的显式全局读取和 `globalTargets` 才产生桥接，因此“默认全目标启用”不等于“默认污染全局”。
- 与旧模式的差别是方向性的：`mode: 'require'` 不写 `webRuntime` 时解析为 `null`（不注入），native 则默认覆盖全部目标并按引用裁剪。

## 5. 体积与构建耗时对照

### 5.1 对照条件

- 同一 fixture `e2e-apps/app-prelude-native`，同一份业务源码与同一组 22 个公开目标。
- `APP_PRELUDE_REQUEST_GLOBALS=1`；压缩组额外设置 `APP_PRELUDE_ES5_MINIFY=1`（该开关只把 `build.minify` 置为 `true`）。
- 分别以 `APP_PRELUDE_MODE=require`、`APP_PRELUDE_MODE=native`、`APP_PRELUDE_MODE=native APP_PRELUDE_NATIVE_SHIM_CHUNK=1` 构建，统计全部 emitted `.js` 字节数。
- 三组数字在本轮同机连续重跑，（918,884 / 840,582 / 744,175 / 660,119 B；native + `prelude: true` 为 851,121 / 669,190 B）；共享占位判定让每组增加数十到数千字节，百分比变化不足 0.3 个百分点，日志 `.tmp/current-run/web-runtime-native-inject/logs/size-sweep.log`。

### 5.2 对照结果

| 构建 | `require` | `native` | `native` + `prelude: true` | native 相对 require 减少 |
| --- | ---: | ---: | ---: | ---: |
| 未压缩 | 918,884 B（12 文件） | 840,582 B（11 文件） | 851,121 B（10 文件） | 8.52%（开启全量安装 + 拆分后 7.37%） |
| 压缩 | 744,175 B（12 文件） | 660,119 B（11 文件） | 669,190 B（10 文件） | 11.30%（开启全量安装 + 拆分后 10.07%） |

`prelude: true` 现在同时把安装范围扩到本轮全部 27 个绑定目标，因此相对默认 `native` 增加 13,222 B（未压缩，+1.58%）/ 9,730 B（压缩，+1.48%）：多出的桥接模块都是固定的 `Reflect.get` 守卫加一次赋值，不再随源码引用裁剪。相对旧 `require` 模式的净收益仍在 7%–10% 区间，emitted 文件数从 11 降到 10。上一轮记录的“拆分再省 1.51% / 1.14%”来自只集中 13 处桥接的旧语义，已随契约变更失效。

该 fixture 的业务代码确实使用 `fetch`、`URL`、WebSocket、axios、stream 与 Vue 页面，两种模式都要保留这些实现，因此差值主要来自 installer 循环、全局写入和未引用目标不再进入产物，而不是 runtime 实现本身消失。前一份审计里 30% 左右的差值来自只引用 2 个目标的人工小程序，条件不同，不能直接对比。

### 5.3 构建耗时

同机、同 fixture、同一环境变量，交替各跑两轮并取预热后的两轮（首次 `require` 冷缓存为 10,061 ms，不计入对照）：

| 模式 | 第 1 轮 | 第 2 轮 | 均值 |
| --- | ---: | ---: | ---: |
| `native` | 3,626 ms | 3,678 ms | 3,652 ms |
| `require` | 5,290 ms | 5,301 ms | 5,296 ms |

native 约低 31%，与它跳过旧模式逐模块源码扫描与 installer 生成一致。该数字只覆盖本机单次构建，不含 dev/watch 增量与真实宿主启动耗时。

按引用精确裁剪由 [nativeSize.test.ts](../../packages/weapp-vite/test/nativeSize.test.ts) 以断言锁定，可重复运行：

- 只引用 `fetch` 时，全量 27 目标配置的启动闭包与 fetch-only 相差小于 5,000 B，产物总字节相差小于 5,000 B。
- `globalThis.fetch` 相对自由标识符只多一个目标桥接，闭包增长小于 1,000 B。
- 压缩后启动闭包与总字节都低于未压缩的 70%。

真实 DevTools 冷启动耗时仍未测量；体积下降不等于启动收益，本报告不做该推断。

## 6. Prelude 与 vendor 拆分

`native` 不再拥有 Web Runtime 启动职责：没有 eager startup 模块、没有 `eagerBindings` 全局锚点、也不通过 Prelude 反向保证 binding 求值顺序。桥接模块自身就是入口闭包里的普通静态依赖，binding 被 tree-shake 的风险由真实引用关系消除，而不是由全局锚点压制。

自定义 App Prelude 在 native 下是一个导出 `runAppPrelude()` 的普通静态模块，入口通过 `weapp-vite:web-runtime:app-prelude-startup` 先 `import` 再调用它，顺序由普通模块依赖保证。产物落盘只有两条与 Web Runtime 相关的 Rolldown 原生分组规则，都在 [sharedBuildConfig.ts](../../packages/weapp-vite/src/runtime/sharedBuildConfig.ts)：

- `weapp-vite:web-runtime-app-prelude`（priority 91，仅在选中 native App Prelude 模式时注册）把自定义前置脚本单独拆成 `weapp-vendors/web-runtime-app-prelude.js`。该模块 id 只在 native 路径生成，旧 `inline` / `entry` / `require` 模式沿用 `app.prelude.js`，因此不再注册一条永不命中的分组。
- `weapp-vite:web-runtime-shim`（priority 92，仅在 `appPrelude.webRuntime.prelude: true` 时注册）把绑定模块、目标桥接模块与 Web Runtime 实现依赖收进同一个 vendor chunk，本轮产物为 `weapp-vendors/shim.js`；同一个开关在解析阶段把 `globalTargets` 扩成本轮全部绑定目标，因此该 chunk 里的桥接覆盖动态 key 等无法静态推断的访问。

除此之外 native 不为 axios 或其他库固定 chunk 名与优先级，也没有第三条规则。两条规则都只在 native 模式注册、只影响产物落盘位置，不参与安装时机；差别在于 shim 那条规则的注册条件同时把安装范围扩到本轮全部绑定目标（见 `resolveInjectRequestGlobalsOptions` 的 native 分支），而 app-prelude 分组只拆分不改范围。`prelude: false`（默认）时 shim 分组根本不存在，交给 Rolldown 自由合并；旧模式两条分组都不存在，`codeSplitting.groups` 与改造前逐条一致。

本轮实测分布（同一 fixture 直连构建）：

- 默认（`prelude: false`）：全局写入只覆盖声明的 `globalTargets` 与源码里真实出现的显式全局访问，实测 13 个目标（`app.js` 内联 11 处桥接、独立分包入口 13 处、`weapp-vendors/common.js` 里 `fetch` / `URL` 2 处）；`XMLHttpRequest`、`WebSocket`、`EventSource` 等既未声明也未被静态识别的目标在全产物中不出现任何 `Reflect.set(globalThis`。自定义 Prelude 独立成 `weapp-vendors/web-runtime-app-prelude.js`。
- `prelude: true`：全部 27 个绑定目标（fixture 声明的 22 个 + `URL` / `URLSearchParams` / `Blob` / `File` / `FormData` 依赖展开）的桥接集中出现在 `weapp-vendors/shim.js`，`app.js` 内不再出现 `Reflect.set(globalThis`，改为其依赖 `app.js → weapp-vendors/shim.js`、`axios.js → weapp-vendors/shim.js`、`pages/native-api/index.js → weapp-vendors/shim.js`、`pages/native-vue/index.js → weapp-vendors/shim.js`；独立分包仍把同批 27 处桥接内联在自己的入口内，闭包不引用主包 `weapp-vendors/shim.js`。

chunk 合并结果随共享策略和压缩配置变化，上述文件名只在对应规则生效时成立；`e2e/ci/app-prelude-native.build.test.ts` 按模块依赖闭包而不是固定文件名做断言，并同时锁定“默认不生成 shim vendor”。

旧 `inline` / `entry` / `require` 模式与默认 `require` 行为保持不变，旧模式仍可用 `weapp.injectWebRuntimeGlobals.prelude` 控制安装时机。native 的同名选项不会进入旧 installer 路径：`e2e-apps/app-prelude-native` 在 native + `prelude: true` 下产物仍然没有任何 installer 符号。

## 7. 其他库的兼容边界

axios 没有专用分支：它的产物闭包只包含源码里真实存在的全局语义（读取全局 `fetch` 与 `URL`），网络默认值通过普通模块依赖 `setMiniProgramNetworkDefaults` 生效。任何第三方库的等价处理都是同一规则——静态可推断就自动桥接，不可推断就用 `globalTargets` 声明，不需要配置库名，也不需要在生成阶段改产物。

## 8. 替代完整性判断

### 8.1 可以把 native 当作更精确替代的场景

- 自由标识符直接使用 `fetch`、`URL`、`FormData` 等。
- `globalThis.fetch`、`globalThis['fetch']`、可选访问、从全局对象解构。
- `window` / `self` / `global` 别名访问。
- 动态 `import()`、Vue SFC、普通分包与独立分包。
- 存在局部同名变量遮蔽，或需要用户自定义 `transform.inject` 覆盖。
- 第三方库内部使用上述形式（必要时补 `globalTargets`）。
- 完全动态求出的 key、间接别名或多层封装的访问：开启 `appPrelude.webRuntime.prelude: true` 后由本轮全部绑定目标的桥接覆盖，无需逐个声明，代价见 5.2。

### 8.2 仍需旧模式或显式全局 shim 的场景

- 运行期写入 `globalThis.<target>` 后立即要求全部模块看到新值（桥接只在缺失时写入，且早于业务读取）。
- 依赖 `delete globalThis.<target>` 改变后续读取语义。
- 完全动态求出的 key、间接别名或多层封装的访问，且既未通过 `globalTargets` 声明，也未开启 `prelude: true` 全量安装。

这些是“精确绑定 + 幂等安装”与“无条件整体安装并允许后续改写”之间的语义差别；继续用 native 覆盖它们会把 installer 重新引回来。

## 9. 本轮验证证据

### 9.1 native `prelude` 扩宽安装范围增量（最新一轮）

契约变更：`appPrelude.webRuntime.prelude: true` 在 native 下除了注册 shim 分组，还把安装集合扩到本轮启用目标全集。实现只落在 `resolveInjectRequestGlobalsOptions` 的 native 分支——把 `targets` 并入 `globalTargets`，依赖展开由 `createWebRuntimeNativeInject` 已有的 `resolveRequestGlobalsBindingTargets` 补齐；注入计划构造器、四处调用点、`nativeInject.ts` 与两条分组规则都没有改动，因此根入口 eager import、按模块静态检测与 shim 归属仍共用同一真源。

- `pnpm --filter weapp-vite typecheck`：通过。首次运行报出把展开集合塞回窄类型 `globalTargets` 的不兼容（`'File'` 不在 `WebRuntimeGlobalTarget` 内），据此改用在解析阶段并集 `targets`、由计划构造器负责展开的方案，避免内部类型与公开配置类型分叉。
- `pnpm --filter weapp-vite test:types`（16 组 tsd）：通过；公开类型本轮无变化（`prelude?: boolean`、`globalTargets?: WeappInjectWebRuntimeGlobalsTarget[]` 均已存在），故不新增 tsd 用例。
- 包级单测：`injectRequestGlobals.test.ts` 62 例、`injectRequestGlobals/nativeInject.test.ts` 10 例、`sharedBuildConfig.test.ts` 38 例、`sharedBuildConfig/rolldown.test.ts`、`emit/requestGlobals/**` 12 个文件 124 例、`test/nativeSize.test.ts` 全通过。
  - resolver 侧把“prelude 只做拆分”的两例改为“prelude 并入启用目标”：`widens native prelude to every enabled target and keeps declared global targets` 断言解析结果 `globalTargets: ['Request', 'fetch']`，`installs every enabled target for native prelude without declaring global targets` 断言未声明时也并入 `['fetch', 'XMLHttpRequest']`；`keeps native global targets explicit when prelude is disabled` 锁定默认态仍是显式集合。
  - 计划侧新增 `installs every bound target globally when native prelude is enabled`：`plan.globalTargets` 与 `plan.bindingTargets` 集合相同、依赖展开的 `URL` 一并安装、宿主已有 `fetch` 保留、Web Runtime 仍只导入一次、产物无 installer 符号。
  - `emit/requestGlobals/native.test.ts` 有 5 例把“拆分不改变安装范围”写成断言，按新契约逐例改写并保留原观察面：根入口在 prelude 下依赖绑定集合、shim vendor 内含 `WebSocket` 等未被源码引用目标的桥接、`appPrelude.webRuntime` 与顶层 `injectWebRuntimeGlobals` 两个作用域行为一致、用户覆盖模块只在安装集合扩宽后被求值一次（`__nativeUserOverrideEvaluations` 为 `['atob']`），且四种“无 installer / 无 bundle patch”断言全部保留。
- 产物核验（重建 `dist` 后直连构建同一 fixture，日志 `.tmp/current-run/web-runtime-native-inject/logs/size-sweep.log`）：`native + APP_PRELUDE_NATIVE_SHIM_CHUNK=1` 的 `weapp-vendors/shim.js` 安装 27 个目标，等于 fixture 的 22 个声明目标加 `URL` / `URLSearchParams` / `Blob` / `File` / `FormData`；`app.js` 内联 0 处 `Reflect.set(globalThis`；独立分包入口自包含同样 27 处且不引用主包 shim。默认 `prelude: false` 仍只安装 13 个目标，`XMLHttpRequest` / `WebSocket` / `EventSource` 在全产物中无任何全局写入。
- CI 构建契约 `e2e/ci/app-prelude-native.build.test.ts` 已同步：prelude 关闭例新增“未声明未引用的三个目标不写全局”的反证，prelude 开启例把 `shim.js` 的安装集合断言为上述 27 个目标的全等集合。名单与反证都在本轮真实产物上逐条核对过，租约恢复后已通过 E2E 入口复跑：`[e2e:ci] summary 1/1 passed`，9 个测试全部通过（含两个改写后的 native 用例）。
- headless runtime 在新契约下复跑：`[e2e:ide-headless-full] summary 1/1 passed`、`Tests 5 passed | 1 skipped (6)`，唯一 skip 是只适用于真实 DevTools 的 native-request-runtime 用例；真实 DevTools 的覆盖仍受第 10.2 节选版限制。


### 9.2 prelude 纯拆分与分组注册收窄增量（上一轮）

- app-prelude 分组注册收窄后（该轮最后一次源码变更）复跑：
  - `pnpm --filter weapp-vite typecheck`：通过。
  - 合并单测一次跑完 22 个文件、306 个测试通过，日志 `.tmp/current-run/web-runtime-native-inject/logs/unit-gate-app-prelude.log`；覆盖 `emit/requestGlobals/**` 全目录 12 个文件、`injectRequestGlobals` 目录与主测试、`sharedBuildConfig.test.ts`、`sharedBuildConfig/rolldown.test.ts`、`test/nativeSize.test.ts`，加 `@wevu/web-apis` 的 `runtime.test.ts`、`import-safety.test.ts`。
  - `sharedBuildConfig.test.ts` 新增 `native app prelude vendor chunk` 4 例：native 下分组 `priority: 91`、`name` 与 `chunkFileNames` 落回 `weapp-vendors/web-runtime-app-prelude.js`、`test` 只命中 prelude 模块 id；反向对照用 `it.each` 锁定 legacy `require`、`appPrelude: { mode: 'native', enabled: false }`、完全未配置 `appPrelude` 三种输入都不注册该分组，`runtime: 'web'` 由既有 shim 用例覆盖。
  - `sharedBuildConfig/rolldown.test.ts` 的分组计数断言恢复为改造前的 `groups.length` 原式：该 fixture 没有 `appPrelude` 配置，收窄后不再出现“注册但永不命中”的分组，原先为绕开它而硬编码的 `activeGroupCount` 已删除；同时保留新增的“每个分组都有非空 `debugName`”断言。
  - CI 构建契约 `e2e/ci/app-prelude-native.build.test.ts` 在重建 `dist` 后复跑：`[e2e:ci] summary 1/1 passed`，9 个测试通过，日志 `logs/ci-build-gate.log`；legacy 四种模式用例与 native、shim 拆分用例同时通过，说明收窄没有改变 native 产物结构。
  - headless runtime 在同一次 `dist` 重建之后复跑：`[e2e:ide-headless-full] summary 1/1 passed`、`Tests 5 passed | 1 skipped (6)`（唯一 skip 只适用于真实 DevTools），日志 `logs/headless-runtime-gate.log`，`[e2e-build-stats] label=ide:app-prelude-native:default-request-runtime warn=0 error=0 exit=0`。
  - 产物目录对照复核收窄效果（同一 `.tmp/e2e-projects/app-prelude-native` 本轮输出）：`native-request-runtime/dist/weapp-vendors/` 仍有 `web-runtime-app-prelude.js`，而 `default/`、`default-request-runtime/`、`legacy-es5-request-runtime/` 三个旧模式目录的 `weapp-vendors/` 只剩 `common.js` 与 `request-globals-web-apis-url.js`，旧模式前置脚本照旧落在 `app.prelude.js`（主包与各分包各一份），`inline/` 不产生独立前置文件——分组确实只是从旧模式产物里退出，没有改变任何模式的实际落盘位置。
- 上一轮增量证据（仍有效，未受本次收窄影响）：
  - `pnpm --filter weapp-vite test:types`（16 组 tsd）：通过；`test-d/config-public-types/streaming.test-d.ts` 新增 `native` + `webRuntime.prelude: true` 正例，并把 `prelude: 'shim'` 断为类型错误（旧的“native 不接受 `prelude`”断言已按新契约移除）。本轮只改分组注册条件，不涉及公共类型，故复用该证据。
  - `packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals.test.ts`：60 例通过（本轮包含在上述合并单测中），锁定 native 默认 `prelude: false`、显式 `prelude: true` 透传，以及旧模式时机语义不变。
  - `emit/requestGlobals/native.test.ts` 的 shim 拆分正反对照 2 例（该文件 19 例）：`prelude: true` 时 `weapp-vendors/shim.js` 存在且同处 `packages-runtime/web-apis` 实现模块与 `weapp-vite:web-runtime:global:fetch` 桥接、页面 chunk 不再内联 `Reflect.set(globalThis`、`app.js` 仍不引用绑定闭包、页面加载后 `typeof globalThis.fetch === 'function'`；`prelude: false` 时不生成该 vendor 且桥接回到入口内联。同一改动把两处“忽略 legacy prelude”的用例标题改为“prelude 只做拆分”，与该轮契约一致；最新一轮已把安装范围扩到启用目标全集并再次改写这些用例，见第 9.1 节。
- 产物复扫：native + `prelude: true` 的 emitted JS 中 `installWebRuntime|axiosEnv|eagerBindings|__wvAXFE__` 命中 0 个文件。
- 体积对照见第 5.2 节；本轮把三组数字重新跑了一遍，`require` 与 `native` 与上一轮完全一致。
- 受影响包重新构建后（`pnpm --filter weapp-vite build`）才执行 fixture 与 CI 验证；相关 ESLint 无告警。
- 上一轮 headless runtime 复跑（shim 拆分态证据）已在机器租约释放后完成两次，均为 `[e2e:ide-headless-full] summary 1/1 passed`、`Tests 5 passed | 1 skipped (6)`（唯一 skip 是只适用于真实 DevTools 的用例）：默认 native 构建日志 `.tmp/current-run/web-runtime-native-inject/logs/headless-runtime-shim2.log`，让 fixture 构建继承 `APP_PRELUDE_NATIVE_SHIM_CHUNK=1` 的拆分态日志 `logs/headless-runtime-shim-env.log`。日志本身不打印开关，因此另以该次运行留下的构建产物核验拆分确实生效：`.tmp/e2e-projects/app-prelude-native/native-request-runtime/dist/weapp-vendors/shim.js` 存在并包含 13 处 `Reflect.set(globalThis`，同目录 `app.js` 为 0 处且引用该 vendor，独立分包入口自包含 13 处；其余模式目录没有 shim 文件。拆分态下独立分包冷启动、懒加载 Prelude、Vue SFC 与页面数据断言与默认态一致。
- 真实 WeChat DevTools Stable runtime 仍未执行，原因见第 10.2 节，因此本轮不构成最终验收。

### 9.3 上一轮（hybrid 收敛）证据

- native 相关定向回归：12 个测试文件，189 个测试通过（inject 计划、binding 与桥接代码、静态全局分析、native 产物与 Prelude 契约、`@wevu/web-apis` runtime/import 安全）。
- `packages/weapp-vite/test/nativeSize.test.ts`：1 个测试通过。
- CI 构建契约 `e2e/ci/app-prelude-native.build.test.ts`：`[e2e:ci] summary 1/1 passed`，8 个测试通过；断言覆盖逐入口 binding 闭包、`globalTargets` 桥接、override 优先级、独立分包不引用主包 binding、禁止 installer/axios patch 符号。
- headless runtime `e2e/ide/app-prelude-native.runtime.test.ts`（`WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless`）：`Tests 5 passed | 1 skipped (6)`，唯一 skip 是只适用于真实 DevTools 的用例。
- `weapp-ide-cli` 安装发现回归：5 个测试文件，44 个测试通过（含新增 Windows EPERM 用例）。
- 包级构建与类型：`weapp-vite`、`@wevu/web-apis`、`weapp-ide-cli` 重新构建通过；相关 ESLint 无告警。
- 文档构建：`pnpm --filter website-weapp-vite build` 通过（36.29s，`seo-quality-report` issueCount 0，仅既有大 chunk 与 configLoader 警告）。

审计与验证期间未执行 DevTools 登出、账号切换或缓存/凭据清理。

## 10. 真实 DevTools 环境的三项发现

### 10.1 Windows 安装发现会因受保护目录整体失败（已修复）

真实 IDE 套件在默认选版阶段调用安装发现，本机以非管理员权限运行时报错：

```text
EPERM: operation not permitted, scandir 'C:\Program Files\WindowsApps'
```

原因是候选扫描把“无法列出该目录”也当成致命错误：Windows 对 ACL 保护目录返回 `EPERM`，而代码只容忍 `ENOENT` 与 `EACCES`。修复位于 [discovery.ts](../../packages/weapp-ide-cli/src/devtoolsTarget/discovery.ts)，把权限拒绝与类型不符一并视为“跳过该目录”；显式登记或显式传入的 CLI 仍按原有错误完整上报，非预期异常继续抛出。回归用例见 [devtoolsDiscovery.test.ts](../../packages/weapp-ide-cli/test/devtoolsDiscovery.test.ts)，并做了反向验证：还原为旧错误列表时该用例失败。修复后同一台机器的只读发现结果：

```text
count= 2
2.02.2611232 nightly
2.02.2611162 nightly
default(stable) selection ERR WECHAT_DEVTOOLS_INSTALLATION_NOT_FOUND
```

### 10.2 本机没有 Stable 安装，真实最终验收被阻塞

- 官方渠道元数据（`https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json`，查询时间 2026-11-25T12:02:11Z）：stable `2.02.2609250`（2026-11-06），rc `2.02.2609231`，nightly `2.02.2611242`。
- 本机实际安装：两个安装的 `resources/app.asar` 应用元数据分别为 `nightly 2.02.2611232` 与 `nightly 2.02.2611162`；`~/.weapp-ide-cli/config.json` 未固定 CLI，registry 为空，`WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 与渠道变量未设置。
- 因此默认“最新 Stable”选版无法命中任何安装，而按既定约束不能静默改用 nightly 顶替 Stable。
- 用户随后明确授权“允许用 nightly 跑 e2e”，本轮据此显式选择本机 nightly `2.02.2611232` 执行真实 IDE 用例；结果见第 10.4 节，该证据只能标注为非 Stable 渠道，不替代 Stable 最终验收。
- 另需记录一次误判并纠正：真实 IDE 用例的正确入口是 `ide-full`（清单把 `ide/app-prelude-native.runtime.test.ts` 按模式展开为 `ide/app-prelude-native.native-request-runtime.runtime.test.ts`），`ide-gate` 的任务集合不包含该文件；此前用 `ide-gate --filter=app-prelude-native.native-request-runtime` 启动得到的是 `No e2e tasks matched filter`（退出前未启动任何宿主），不是产品失败。
- 启动前的资源采样：无 DevTools 进程、无活动 E2E 租约；系统可用内存在 0.90 GB 与 2.82 GB 之间波动（补齐阶段再次采样为 2.69 GB），机器上另有其他项目的手动 node 进程，均按归属未知保留、未终止。
- 补齐 Stable 的可行性已核对但不代为执行：官方 stable Windows x64 安装包 `wechat_devtools_2.02.2609250_win32_x64.exe` 可正常下载（HEAD 200，`accept-ranges: bytes`，187.7 MB），C 盘剩余 23.1 GB。安装属于对本机的软件变更，且安装过程可能触发系统授权提示，因此按约束交由用户决定，不在本任务内自动安装或改用 nightly 顶替。

### 10.3 机器级 E2E 租约：曾排队后复跑通过，现被本任务 nightly 运行的残留占用

native `prelude` 增量完成后，本任务尝试复跑 headless runtime：

```text
node --import tsx ./e2e/scripts/run-e2e-suite.ts ide-headless-full --filter=app-prelude-native.runtime
Error: Runtime busy: another E2E operation owns this machine. Wait for its owner to finish before retrying.
```

按只读方式核对 `machine-e2e/owner.json`，持有者是同一台机器上另一工作树的真实 DevTools 套件（`e2e/ide/wevu-a2ui.runtime.test.ts`），并非本任务遗留资源。按全机同用户串行约束，本任务等待该运行结束，不清除其租约、不终止其进程，也不改用不带租约的直接 `vitest` 绕过门禁。

该租约随后自然释放，headless 复跑已在增量之后完成（默认态与 `APP_PRELUDE_NATIVE_SHIM_CHUNK=1` 拆分态各一次，均 `[e2e:ide-headless-full] summary 1/1 passed`），证据与产物核验见第 9.2 节。本节保留排队过程，是为了记录该门禁在本机确实生效而不是形式检查。真实 DevTools runtime 复跑当时未执行，阻塞原因与第 10.2 节的 Stable 选版相同，与租约无关。

最新一轮的状态不同：nightly 真实 IDE 运行（见第 10.4 节）失败后留下了未完成的机器租约，`machine-e2e/owner.json` 记录的 owner pid 已退出，但 `scopes/` 下仍有两个 `sealed: true`、`completed: false` 的任务作用域（本任务 fixture 的父作用域与其 child 作用域），因此 `acquireDirectoryLease` 的“无未完成作用域”前提不成立，CI 与 headless 入口都在测试开始前被 `Runtime busy` 拒绝——这两个入口共用同一机器互斥。对应的受管窗口 journal 记录 `state: "failed"`、`openedProjectWindow: true`、宿主 pid 与登记端口在本轮复核时仍存活，且没有 `windowClose` 字段，说明关闭从未派发。

按约束本任务没有手工删租约、删 journal、清 session 或按进程名清理，也没有把该状态写成通过。可用的正规出口是安装退出恢复（`recoverMachineE2ELease` + `recoverManagedWechatProjectsAfterInstallationExit`），前提是该微信开发者工具安装的全部进程确实已退出；这需要正常退出用户机器上的共享 IDE，而本轮缺少 Computer Use 一类工具来核实“只剩项目列表、无手动窗口/对话框”，因此该前提无法核实，宿主与现场按原样保留并交由用户决定。恢复完成后需要重跑的是：`e2e/ci/app-prelude-native.build.test.ts`、`ide-headless-full --filter=app-prelude-native.runtime`，以及在显式 nightly 渠道下的一次真实 IDE 用例。

补充只读核验（不改动现场）：该 nightly 安装的主进程早于本轮测试启动（约四小时前，含 `--cli --remote-port` 参数），本轮测试用的受管窗口与登记端口都是它派生出的子进程；进程树里还有交互式终端宿主进程，说明这个安装可能正被人工使用。因此“安装退出恢复”不是本任务可以自行触发的操作：退出会同时终结用户可能正在进行的工作，且没有 Computer Use 就无法在退出前核对窗口内容。

恢复结果（用户授权后完成，未退出宿主）：先封存租约、journal 与宿主快照，再用官方 `close --project` 只关闭本任务登记的受管窗口，经合并后的会话日志选择核验窗口销毁与端口关闭，最后通过 `recoverMachineE2ELease` 接管快照完成两个未完成作用域并释放租约。journal 记录变为 `released`（`releasedReason: project-closed`），登记端口不再监听，`machine-e2e` 目录连同 owner/scopes 一起移除，微信开发者工具主进程保持运行、登录态未受影响；恢复审计写入 `machine-e2e-recoveries/`。

该残留作用域此前还会让 pre-commit 阶段触发 `e2e/**` 规则的 `dom-inventory` 任务失败（它经 `run-e2e-commands` 共用同一机器互斥），因此本轮先提交了不触发该规则的部分；租约释放后 `e2e/ci` 的新增断言已单独通过，见 9.1 节。

### 10.4 授权后的 nightly 真实 IDE 运行：受 Windows MAIN 日志消歧阻塞（未完成）

- 选版：用户显式授权 nightly，本轮固定到 `2.02.2611232` 安装，预检、启动与清理共用同一显式 CLI；报告渠道标注为 nightly，不作为 Stable 验收证据。
- 首个错误出现在受管窗口收尾阶段，而非页面断言：`Managed DevTools window-close evidence requires one unambiguous MAIN log for the selected product version.`
- 结构性原因（`cross-platform suspect: checking command launch, path normalization, line endings, and filesystem assumptions before product logic`）：窗口关闭证据要求在该安装的 `WeappLog/logs` 中，恰好只有一个 `.log` 文件含 `[<version>][MAIN]` 记录。本机该版本有 6 个文件命中（行数分别约 2、491、2、516、2、2997），因此判定始终歧义；`captureActiveMainLogCursors` 只在 macOS 生效，Windows 走的是全目录扫描分支，所以重启宿主并不能消除历史日志造成的歧义。
- 该失败属于宿主证据链而非产品行为：native 构建、模块依赖与 headless 侧观察均未出现新异常。按约束保留首错与 journal，不用 `simulator launch success` 日志、重复启动或放宽断言覆盖它。
- 修复归属：本任务曾在本分支实现一版 Windows 选择器（父进程身份 + 会话时间跨度），随后同步上游时发现 main 已用另一种方式解决同一问题——`captureLogCursors` 增加受管会话上下文，只接受“启动时间之后出现完整项目路径”的 MAIN 日志，非 macOS 平台由 `windowClose.ts` 自动传入项目路径与创建时间。两者目标一致，按单一真源原则本分支**删除自己那版实现**，改用上游方案；上游已随该修复附带 `weapp-ide-cli` changeset 与回归用例。
- 上游规则的实测核验（只读）：用本机该版本的日志目录与第二次失败运行的 journal 记录调用合并后的 `captureLogCursors(directory, version, { projectPath, startedAt })`，唯一选中 `2026-11-26-09-26-31-806.log`；同一目录不带会话上下文时仍报 `one unambiguous MAIN log`，说明消歧来自会话路径证据而不是放宽断言。旧实现留下的记录、游标、锚点与逐行消费校验在合并后保持一致。
- 修复后同一用例尚未跑通真实 DevTools：租约恢复后按同机同用户串行规则重跑一次（`ide-full --filter=app-prelude-native.native-request-runtime`，显式 nightly 渠道）。
  - 第一次重跑在 178s 后失败于 `launch automator` 的 `app-ready` 阶段（最后一次成功阶段为 `bridge-connect`），随后收尾又撞上本次修复前的 MAIN 日志歧义，才留下 10.3 节的残留租约。
  - 按“同一故障最多一次正常重启”的约束，通过显式选定 CLI 发送官方 `quit`（退出前该安装已连续运行约 4 小时），核验整棵进程树退出后，再用同一 CLI 重开并重跑一次。
  - 重启后的运行仍失败，但症状不同：`Runtime log subscription deadline exhausted after 14 attempts` / `Timeout in runtime log subscription after 141557ms`，并被标记为未归类的 IDE runtime 错误，同时缺少实际 IDE 与基础库版本观测；用例耗时 252s。据此停止继续重启，保留首错与两次日志。
  - 两次失败的收尾本身是修复生效的证据：重启后的运行结束时没有残留机器租约（`machine-e2e` 目录不存在），登记端口不再监听；受管记录为 `released` / `project-closed`，并保存了 `nativeClosedAt` 与 `webContentsDestroyedAt` 两个销毁时间戳，说明会话日志选择在 Windows 上能完整拿到关窗证据。
  - 结论：真实 DevTools runtime 的 native 用例仍**未完成**，阻塞点是该 nightly 安装的 automator/runtime log 在预算内没有就绪，而不是 native 契约或关窗证据；Stable 在本机不存在，nightly 结果本来也不能替代 Stable 验收。

## 11. 复现命令

```bash
# CI 构建契约
node --import tsx ./e2e/scripts/run-e2e-suite.ts ci --filter=app-prelude-native.build.test.ts

# native 单测（含 sharedBuildConfig 分组与 resolver）
pnpm vitest run packages/weapp-vite/src/runtime/sharedBuildConfig.test.ts packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals.test.ts

# headless runtime（provider=headless，需先取得全机 E2E 串行租约）
node --import tsx ./e2e/scripts/run-e2e-suite.ts ide-headless-full --filter=app-prelude-native.runtime

# 真实 DevTools Stable（本机需先安装并登记 Stable；nightly 需显式指定渠道或 CLI）
node --import tsx ./e2e/scripts/run-sleep-inhibited-e2e-suite.ts ide-full --filter=app-prelude-native.native-request-runtime

# 体积对照（同一 fixture，三种模式；每组再加 APP_PRELUDE_ES5_MINIFY=1 得到压缩组；耗时对照按 native/require 交替各跑两轮取预热值）
APP_PRELUDE_MODE=require APP_PRELUDE_REQUEST_GLOBALS=1 node ../../packages/weapp-vite/bin/weapp-vite.js build
APP_PRELUDE_MODE=native  APP_PRELUDE_REQUEST_GLOBALS=1 node ../../packages/weapp-vite/bin/weapp-vite.js build
APP_PRELUDE_MODE=native  APP_PRELUDE_REQUEST_GLOBALS=1 APP_PRELUDE_NATIVE_SHIM_CHUNK=1 node ../../packages/weapp-vite/bin/weapp-vite.js build
```

## 12. 最终判定

- 作为 transform-runtime 式精确绑定模式，并且同时覆盖显式全局语义：**满足**。
- 作为零配置的覆盖面：`mode: 'native'` 单独即启用全部 22 个允许目标，不读取依赖包名，未引用实现被 tree-shake：**满足**。
- 作为无 installer、无按库产物补丁、体积更小、构建更快的旧模式替代方案：**对静态可推断的用法满足**（未压缩 −8.52%、压缩 −11.30%、未压缩构建耗时约 −30%）。
- 作为覆盖全部全局副作用语义的无条件替代品：**部分满足**。无法静态推断的隐藏访问现在有两种 native 出口：逐个声明 `globalTargets`，或用 `prelude: true` 一次安装本轮全部启用目标（多付约 1.5% 产物体积，见 5.2）。仍保留给旧模式的是运行期改写或删除 `globalThis.<target>` 后立即要求全局可见这一类副作用语义。
- 作为“Prelude 只承担普通模块职责，其余只是 vendor 拆分”的方案：**满足其职责，但拆分不再是唯一效果**。启动协调已完全去掉；自定义前置脚本由一条 Rolldown 原生分组规则独立成 `weapp-vendors/web-runtime-app-prelude.js`。第二条规则（`appPrelude.webRuntime.prelude: true`）把绑定、桥接与实现拆进 `weapp-vendors/shim.js`，同时按本轮契约把安装集合扩到全部启用目标：本轮实测该变体相对 `require` 仍省未压缩 7.37%、压缩 10.07%，相对默认 `native` 增 1.25% / 1.37%，emitted 文件数 11 → 10，`app.js` 不再内联桥接。两条规则都只在 native 模式注册，都不引入 installer 或启动时机语义（旧模式的 `codeSplitting.groups` 与改造前逐条一致）。
- CI 构建契约与 headless runtime：**满足**。租约恢复后已在新代码上复跑：`e2e/ci` 9/9 通过（含改写后的两条 native 断言），`ide-headless-full` 5 通过 / 1 跳过（跳过项只适用于真实 DevTools）。
- 真实 WeChat DevTools Stable runtime 验收：**未完成**。本机无 Stable 安装，按约束不得用 nightly 结果替代 Stable；用户授权的 nightly 运行此前停在 Windows MAIN 日志歧义上（第 10.4 节），该歧义已由上游的会话日志选择修复（本分支同步该方案，见第 10.4 节），残留租约与受管窗口也已通过正规恢复收尾（第 10.3 节），修复后的失败运行同样没有残留。重启宿主后重跑一次，仍在该 nightly 的 automator / runtime log 就绪阶段超时（第 10.4 节），因此真实宿主上的 native 用例未跑通；在 Stable 可用或用同一用例在可用的 IDE 版本上跑通之前，本任务不能标记为最终验收通过。
