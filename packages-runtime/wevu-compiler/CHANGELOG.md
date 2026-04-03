# @wevu/compiler

## 6.13.2

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.13.2`

## 6.13.1

### Patch Changes

- 🐛 **同步升级 workspace catalog 与 `create-weapp-vite` 模板 catalog 中的 Vue 相关依赖版本，统一到 `3.5.32`，并刷新 `@types/node`、`@tanstack/vue-query` 及锁文件，确保工作区内发布包、示例应用与脚手架生成结果使用一致的依赖基线。** [`d2ea11e`](https://github.com/weapp-vite/weapp-vite/commit/d2ea11efc6b2248a9a5ee6e5e692646c0562a211) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.13.1`

## 6.13.0

### Patch Changes

- 🐛 **修复 `app.vue` 中 `defineAppSetup()` 需要手动从 `wevu` 导入的问题。现在 `defineAppSetup` 会像其他 SFC 宏一样自动注入运行时导入，并同步补齐全局类型声明与编译测试，允许在 `<script setup lang="ts">` 中直接编写 `defineAppSetup((app) => app.use(...))`。** [`0bfdded`](https://github.com/weapp-vite/weapp-vite/commit/0bfdded627071e594f6b37d84d2e2f84103c5642) by @sonofmagic

- 🐛 **为 Vue SFC 的双脚本场景补充 `lang` 一致性校验：当同一个文件同时声明 `<script>` 与 `<script setup>` 时，`@wevu/compiler` 现在要求两者的 `lang` 完全一致，否则会在解析阶段直接抛出明确错误，避免后续编译链路在混合脚本语言下出现不一致行为。** [`91fb364`](https://github.com/weapp-vite/weapp-vite/commit/91fb36463eaf924ec556b77c86046c4baa4de979) by @sonofmagic

- 🐛 **修复 `app.vue` 中 `defineAppJson()` 在双 `<script>` 场景下对普通 `<script>` 绑定的读取缺陷。现在当普通 `<script>` 与 `<script setup>` 同时存在时，JSON 宏求值与 `auto-routes` 内联会一并覆盖普通 `<script>` 的顶层导入/声明，允许把 `import routes from 'weapp-vite/auto-routes'`、`import { pages, subPackages } from 'weapp-vite/auto-routes'` 这类写法放在普通 `<script lang="ts">` 中，再由 `<script setup lang="ts">` 里的 `defineAppJson()` 直接使用。** [`a9896b4`](https://github.com/weapp-vite/weapp-vite/commit/a9896b47e365ea94e9379936c50111d8b962ab78) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.13.0`

## 6.12.4

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.12.4`

## 6.12.3

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.12.3`

## 6.12.2

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.12.2`

## 6.12.1

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.12.1`

## 6.12.0

### Patch Changes

- 📦 **Dependencies** [`c46de52`](https://github.com/weapp-vite/weapp-vite/commit/c46de52e65ed10146784ab583580600daa4320bf)
  → `@weapp-vite/ast@6.12.0`, `rolldown-require@2.0.12`

## 6.11.9

### Patch Changes

- 📦 **Dependencies** [`0066308`](https://github.com/weapp-vite/weapp-vite/commit/0066308e1af282e9bc204143e685c54edd490f41)
  → `rolldown-require@2.0.11`, `@weapp-vite/ast@6.11.9`

## 6.11.8

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.8`

## 6.11.7

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.7`

## 6.11.6

### Patch Changes

- 📦 **Dependencies** [`3094be8`](https://github.com/weapp-vite/weapp-vite/commit/3094be81a5c569237425602388b7a7a579cdbce0)
  → `rolldown-require@2.0.10`, `@weapp-vite/ast@6.11.6`

## 6.11.5

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.5`

## 6.11.4

### Patch Changes

- 🐛 **为 `layout-host` 增加通用的编译期声明与运行时实例解析机制：layout 内组件可直接用 `layout-host="..."` 暴露宿主，`wevu` 会优先从运行时已解析的宿主实例读取能力，减少页面/组件侧对 `selector`、`id`、`useTemplateRef()` 和手动注册 bridge 的依赖。同步修复 `weapp-vite` 在 layout 构建时错误输出 scriptless stub 的问题，并更新 TDesign wevu 模板与 DevTools e2e，用例覆盖首页 toast、layout-feedback 页面 alert/confirm 以及无 `未找到组件` 警告的场景。** [`e52f7b1`](https://github.com/weapp-vite/weapp-vite/commit/e52f7b1f00b9007bd4a25b2414bc52f5a30890aa) by @sonofmagic
- 📦 **Dependencies** [`aae675c`](https://github.com/weapp-vite/weapp-vite/commit/aae675c4084864f16d74cce1d0f19592d6abf0c6)
  → `rolldown-require@2.0.9`, `@weapp-vite/ast@6.11.4`

## 6.11.3

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.3`

## 6.11.2

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.2`

## 6.11.1

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.1`

## 6.11.0

### Minor Changes

- ✨ **为 `weapp-vite` 新增了接近 Nuxt `app/layouts` 的页面布局能力：支持在 `src/layouts` 目录中约定 `default` 或命名布局，并通过 `definePageMeta({ layout })` 为页面声明使用的布局，同时支持 `layout: false` 显式关闭默认布局。布局组件既可以使用 Vue SFC，也可以使用原生小程序组件；编译阶段会自动包裹页面模板、注入布局组件的 `usingComponents` 配置，并让页面内容通过布局内的 `<slot></slot>` 渲染，同时提供对应的宏类型声明。** [`35a6ee0`](https://github.com/weapp-vite/weapp-vite/commit/35a6ee06d7b8fa56435684011cc706ea5bf9f432) by @sonofmagic
  - 此外，`definePageMeta` 现已支持对象写法的布局配置，例如 `layout: { name: 'panel', props: { sidebar: true, title: 'Dashboard' } }`。当前会将静态字面量 `props` 编译为布局标签属性，并同时覆盖 Vue 布局与原生小程序布局场景。
  - 同时，`weapp-vite` 现在会将默认生成的 `components.d.ts`、`typed-components.d.ts`、`typed-router.d.ts`、`auto-import-components.json` 等支持文件统一输出到项目根目录下的 `.weapp-vite/` 中，并建议通过 `.gitignore` 忽略该目录，减少源码目录中的生成噪音。CLI 新增了 `weapp-vite prepare` 命令，可在开发、构建或类型检查前预先生成这批文件；相关模板与示例项目的 `tsconfig` 和脚本也已同步调整到新的输出目录。仓库模板与 `apps/*` 现在默认在 `postinstall` 阶段执行 `weapp-vite prepare`，Tailwind 场景会在 `weapp-tw patch` 之后继续生成 `.weapp-vite` 支持文件，行为上更接近 Nuxt 的 `nuxt prepare`；`e2e-apps/*` 仍保持轻量，不默认加入这一步以避免放大测试夹具安装成本。

### Patch Changes

- 🐛 **修复 `<script setup>` 类型声明 props 在小程序运行时的结构化类型告警回归。`@wevu/compiler` 现在会对类型声明生成的 `Array/Object` 类 props 放宽小程序属性校验，避免作用域插槽等场景下出现误报；`weapp-vite-wevu-tailwindcss-tdesign-template` 中的 `KpiBoard` 也因此可以恢复原本的 `defineProps<...>` 与 `#items` 写法，并在 DevTools e2e 中保持 `warn=0`。** [`b387a51`](https://github.com/weapp-vite/weapp-vite/commit/b387a519b85851fe71657a29bd59848dd16ae836) by @sonofmagic

- 🐛 **修复了一组由类型产物路径迁移与 `defineOptions` 临时求值模块带来的回归问题。`auto-routes` 与模板相关 e2e 现已统一校准到 `.weapp-vite` 下的 `typed-router.d.ts`、`components.d.ts`、`typed-components.d.ts` 等托管产物路径，子包构建断言也改为基于稳定语义而不是压缩后的局部变量名，避免因为产物重命名导致误报。** [`36de3a6`](https://github.com/weapp-vite/weapp-vite/commit/36de3a69c5eab302bac1ea31b5cf974c4f14fa98) by @sonofmagic
  - 同时，`@wevu/compiler` 生成的 `defineOptions` 临时模块不再混用 default export 与 named export，消除了构建阶段的 `MIXED_EXPORTS` 警告；仓库根 `tsconfig.json` 里的 Volar 插件声明也改为使用 `weapp-vite/volar` 包名，避免子项目继承根配置后执行 `vue-tsc` 时出现插件相对路径错位告警。这些修复会同步改善 `weapp-vite` 模板与脚手架生成项目的类型检查体验，因此一并补充 `create-weapp-vite` 的版本变更。

- 🐛 **增强 `defineOptions` 的序列化与内联能力，支持在宏配置中安全引用顶层局部常量；同时将 retail 模板中的遗留 CJS 与 `wxs` 辅助逻辑迁移为 ESM/TypeScript 实现，避免模板脚手架继续产出 CommonJS 风格代码。** [`8e91f3d`](https://github.com/weapp-vite/weapp-vite/commit/8e91f3dd3f89a94f4a3bb55a1aaf35bb2618096d) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.0`

## 6.10.2

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.10.2`

## 6.10.1

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.10.1`

## 6.10.0

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.10.0`

## 6.9.1

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/ast@6.9.1`

## 6.9.0

### Minor Changes

- ✨ **为 `weapp-vite` 与 `@wevu/compiler` 新增统一的 AST 抽象层，默认继续使用 Babel，并允许在多条纯分析链路中通过配置切换到 Oxc。此次调整同时把组件 props 提取、`usingComponents` 推导、JSX 自动组件分析、`setData.pick` 模板 key 收集、re-export 解析、页面特性分析与部分 emit 阶段快判等能力逐步下沉到可复用的 `ast/operations`，并补充高层配置透传测试，确保 `weapp.ast.engine = 'oxc'` 能从真实插件入口传到对应分析逻辑。** [`3836235`](https://github.com/weapp-vite/weapp-vite/commit/3836235d8784ce0e5e1bd4c920f33a82d4c28844) by @sonofmagic

### Patch Changes

- 🐛 **新增 `@weapp-vite/ast` 共享 AST 分析包，统一封装 Babel/Oxc 解析能力以及平台 API、require、`<script setup>` 导入分析等通用操作，并让 `weapp-vite` 与 `@wevu/compiler` 复用这套内核，降低后续编译分析工具的维护分叉成本。** [`7bc7ecc`](https://github.com/weapp-vite/weapp-vite/commit/7bc7ecca2aef913b0751d18f9c0f586bd582dc01) by @sonofmagic
- 📦 **Dependencies** [`3021847`](https://github.com/weapp-vite/weapp-vite/commit/302184760fc7680d7f57ec3ecd50664311652808)
  → `@weapp-vite/ast@6.9.0`, `@weapp-core/shared@3.0.2`, `rolldown-require@2.0.8`

## 6.8.0

## 6.7.7

### Patch Changes

- 📦 **Dependencies** [`88b2d31`](https://github.com/weapp-vite/weapp-vite/commit/88b2d316fe1238ea928abf7d63d0cb63ae29e1e8)
  → `rolldown-require@2.0.7`

## 6.7.6

## 6.7.5

### Patch Changes

- 🐛 **修复 issue #328 中 `<script setup>` 首帧数据与子组件 prop 同步过晚的问题：编译产物现在会为可静态推导的 setup 初始值注入首帧 `data`，运行时注册阶段也会把这些初始数据同步保留到原生组件/页面定义中，避免父级 `ref('111')` 在首屏绑定到子组件 `String` prop 时先落成 `null` 并触发小程序类型 warning。同时补充 `github-issues` 的 issue-328 构建与 IDE 端到端回归用例，以及相关运行时/编译单测。** [`62619d9`](https://github.com/weapp-vite/weapp-vite/commit/62619d9b6b3e71afb99dc44bde51d6b0cfa1e322) by @sonofmagic

- 🐛 **优化 JSX 编译流程：合并重复的 Babel AST 遍历，将 compileJsxFile 中对同一源文件的多次 babelParse 和 traverse 合并为单次解析和单次遍历，减少编译开销。** [`588be88`](https://github.com/weapp-vite/weapp-vite/commit/588be88139b35dee86c99982d2266c4dfc1c75e8) by @sonofmagic

## 6.7.4

### Patch Changes

- 🐛 **整合 wevu compiler 相关 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **cool-rings-double.md**：修复 `<script setup>` 中 `defineOptions({ behaviors: [...] })` 的编译兼容性：当 `behaviors` 依赖原生 `Behavior()` 返回值且构建环境不存在全局 `Behavior` 时，不再在 `defineOptions` 内联阶段抛错，而是回退为保留原始 `defineOptions` 表达式继续编译。补充了内联单测与 `compileVueFile` 端到端测试，覆盖内建行为字符串与原生 `Behavior` 导入两类场景。

- 🐛 **修复模板中 `:class` 与 `v-show` 绑定表达式在首帧访问未就绪对象（如 `errors.email`）时的闪烁问题。现在 class/style 运行时绑定在表达式抛错时会使用更安全的回退值：`class` 保留静态类名，`v-show` 默认回退到 `display: none`，避免先显示后隐藏和样式短暂丢失。同时补充 template 解析阶段的 HTML void 标签处理：当 `input` 等标签未显式书写 `/>` 时，编译器会按自闭合标签解析并输出，避免后续兄弟节点被错误嵌套进 `input`。** [`f2da08b`](https://github.com/weapp-vite/weapp-vite/commit/f2da08b48b7d44fe60ac27dc91a742afda1055b5) by @sonofmagic

- 🐛 **汇总 `c8f491b328e2151eb8b8d284a1fac0974de09476` 与 `4ba41941f18028bedbb4b8d75426780b442d95c6` 两个重构提交。** [`590893f`](https://github.com/weapp-vite/weapp-vite/commit/590893f02d3bac84a4b3566326cbe5498880edf9) by @sonofmagic
  ## 变更摘要
  1. `c8f491b328e2151eb8b8d284a1fac0974de09476`：重构 `@wevu/compiler`，将过长源码拆分为职责更聚焦的模块（覆盖 JSX 编译流程、`vueSfc` block src 解析、template 元素辅助逻辑、class/style computed 构建、`defineOptions` 序列化等），降低单文件复杂度并提升维护性。该提交以代码组织优化为主，不改变既有编译语义。
  2. `4ba41941f18028bedbb4b8d75426780b442d95c6`：重构 `@weapp-vite/web` 运行时，拆分 `element`、`mediaApi`、`network`、`selectorQuery` 等超长模块为独立子模块（如 `mediaApi/*`、`network/*`），并抽离配套类型定义，增强边界清晰度与后续可扩展性。该提交同样以结构重排为主，不引入对外行为变更。

## 6.7.3

## 6.7.2

### Patch Changes

- 🐛 **修复小程序模板编译时 kebab-case 自定义事件的绑定属性生成规则：`@overlay-click` 现在会输出 `bind:overlay-click`（以及 `catch:overlay-click`），不再错误输出 `bindoverlay-click`。同时补充 issue #316 的单元与 e2e 回归覆盖，确保构建产物和 DevTools 运行时都能正确触发事件。** [`41b049f`](https://github.com/weapp-vite/weapp-vite/commit/41b049f6bca3cd870343dd5b515597075e0c1686) by @sonofmagic

## 6.7.1

### Patch Changes

- 🐛 **修复 `@wevu/compiler` 在 `defineOptions` 与组件事件内联表达式组合场景下的注入缺陷：当组件选项通过 spread 合并且 `methods` 来自 spread 对象时，内联事件映射会新增同名 `methods` 键导致原方法被覆盖，进而在模板中触发 `@change="onChange"` 时出现 `onChange is not a function`。本次调整为按 spread 来源合并 `methods` 后再注入 `__weapp_vite_inline_map`，并恢复零售模板 tabbar 使用标准 Vue 事件写法，避免运行时方法丢失。** [`662630e`](https://github.com/weapp-vite/weapp-vite/commit/662630e7c12e49bf783d7e728618fbbad863ff3b) by @sonofmagic

- 🐛 **修复 `defineOptions` 参数内联模块的 TypeScript 类型定义：序列化内置构造器映射时，原类型仅允许“可调用函数”，会导致 `WeakMap` / `WeakSet` 等仅可构造对象出现类型不兼容。现已调整为同时支持“可调用或可构造”类型，消除该文件的类型报错且不改变运行时行为。** [`bc7a59a`](https://github.com/weapp-vite/weapp-vite/commit/bc7a59a3181cb71e0593ed6b628e2124cb1b021b) by @sonofmagic

- 🐛 **修复了 `defineOptions` 静态内联在模板项目中的编译问题：当配置对象中包含对象方法写法（如 `data() {}`）或内置构造器类型（如 `String`/`Number`）时，之前可能被错误序列化为不可解析代码或被误判为不支持的原生函数。此次同时收敛了 defineOptions 依赖提取范围，避免仅在方法体中使用的模块被提前求值导致构建失败。并同步保留零售模板的 TypeScript 路径映射配置，确保模板工程一致性。** [`8184b9f`](https://github.com/weapp-vite/weapp-vite/commit/8184b9f12b9aafb18292516cb03102db074c9c43) by @sonofmagic

## 6.7.0

## 6.6.16

### Patch Changes

- 🐛 **修复 `app.vue` 中 `<script setup>` 的 `defineOptions` 不能引用局部变量或导入变量的问题，并统一增强宏配置提取体验：** [`a1ae4a6`](https://github.com/weapp-vite/weapp-vite/commit/a1ae4a6abe0374644a32d0078085bd662faae641) by @sonofmagic
  - 新增 `defineOptions` 参数静态内联能力，支持引用本地声明与跨文件导入（包含 `weapp-vite/auto-routes` 顶部静态引入场景）。
  - `auto-routes-define-app-json` 示例改为单 `script setup`，同一份 `routes` 同时用于 `defineAppJson` 与运行时 `globalData`。
  - 补充单元测试与 e2e 测试，覆盖 JSON 宏和 `defineOptions` 对局部/导入变量的兼容性与热更新回归。

## 6.6.15

## 6.6.14

### Patch Changes

- 🐛 **修复 issue #309 的页面生命周期边界场景：页面未声明 `onPullDownRefresh` 或使用 `setupLifecycle: 'created'` 时，`onLoad` 仍会稳定触发，同时避免编译阶段重复注入 `__wevu_isPage`。补充对应单元测试与 e2e 用例，防止后续回归。** [`39227de`](https://github.com/weapp-vite/weapp-vite/commit/39227de97e3d6e4e1f82b14a6ce5e8bce918b0d9) by @sonofmagic

## 6.6.13

### Patch Changes

- 🐛 **在编译器文件读取与 SFC 解析链路中统一将 `CRLF/CR` 归一化为 `LF`，从框架层消除 Windows、Linux、macOS 的行尾差异；同时补充底层缓存读取与 `compileVueFile` 的跨行尾一致性测试，避免用户项目未配置 `.gitattributes` 时出现解析/匹配不一致问题。** [`ebdd313`](https://github.com/weapp-vite/weapp-vite/commit/ebdd313e94ebcbc0570b9bf1b44c2e403423d45a) by @sonofmagic

## 6.6.12

## 6.6.11

### Patch Changes

- 🐛 **修复同一节点绑定多个事件时的 inline 事件冲突：编译器为不同事件生成按事件名分片的 dataset 键（如 `data-wv-inline-id-tap`），运行时按 `event.type` 读取对应键并保持兼容回退。补充组件 `emit` 与 `$event` 的单元测试和 e2e 覆盖，并在 `wevu-vue-demo` 的 `vue-compat/template` 页面新增单节点多事件（参数 + `$event`）示例。** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509) by @sonofmagic

- 🐛 **修复组件自定义事件在模板监听中的 `$event` 语义：编译期为组件事件注入 `data-wv-event-detail` 并将简单处理器按 inline 路径编译，运行时据此将 `$event` 解析为 `event.detail`，避免出现 `emit: undefined @ undefined`。同时补充 `wevu-vue-demo` 的 `$event` 上抛示例，并新增编译器、运行时与 e2e 集成测试覆盖。** [`e2aa20e`](https://github.com/weapp-vite/weapp-vite/commit/e2aa20e1cf79b4c5c3c36735b967c6fd5583486f) by @sonofmagic

## 6.6.10

## 6.6.9

### Patch Changes

- 🐛 **修复模板表达式在 `v-for` 场景下错误优先读取 `__wevuProps` 导致 `:class` 不响应更新的问题；新增 issue #302 的编译与运行时 e2e 用例，覆盖点击切换后 class 与状态同步更新的行为。** [`b6f2e49`](https://github.com/weapp-vite/weapp-vite/commit/b6f2e49c5a4642037b23feb2d1764e5915005869) by @sonofmagic

## 6.6.8

### Patch Changes

- 🐛 **修复 `defineProps` 布尔类型在模板调用表达式（如 `String(bool)`）中的运行时绑定结果为 `undefined` 的问题（#300）。编译器现在会对模板运行时绑定标识符增加 `__wevuProps` 回退读取逻辑；运行时则预置并复用响应式 `__wevuProps` 容器，确保计算属性首次求值即可建立正确依赖并在 props 变更时稳定更新。** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de) by @sonofmagic
  - 同时补充对应的编译回归测试与运行时同步测试，覆盖 `script setup` 的 props 解构场景。

- 🐛 **修复 issue #300 场景下 `String(props.bool)` 在组件交互后不响应变更的问题，避免生成 `__wevuProps.props` 访问路径，并完善 props 同步与同名 setup 绑定的运行时处理及 e2e 回归测试。** [`9b2c623`](https://github.com/weapp-vite/weapp-vite/commit/9b2c623d7a6ca0b254ad55cc9a392ea8058e1141) by @sonofmagic

- 🐛 **修复 issue #300 场景下 `<script setup>` 中仅使用 `defineProps` 类型声明且未声明 `props` 变量时，模板调用表达式（如 `String(bool)`）在小程序运行时出现初始值错误或 props 变更后不响应的问题，并补充对应的构建与 IDE 端到端回归测试。** [`253fc99`](https://github.com/weapp-vite/weapp-vite/commit/253fc99ee8179e43c0ea96dded4773eed52c7663) by @sonofmagic

- 🐛 **修复 `wevu` 模板编译在小程序端对可选链表达式（`?.`）的兼容性问题：在模板编译阶段将 `?.` 安全降级为条件表达式，避免产物 WXML 在微信开发者工具中出现语法报错，并补充对应编译测试与集成测试覆盖。** [`3f1253e`](https://github.com/weapp-vite/weapp-vite/commit/3f1253e5bd1dbb320566e869d172048c63265a56) by @sonofmagic
  - 同时对 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 进行路由与页面结构对齐：同步主包与分包路由配置至 `tdesign-miniprogram-starter-retail`，补齐自定义 `tabBar` 形态，并将页面壳改为按路由渲染对应版式（如首页、分类、购物车、商品详情、订单列表与表单页等），确保新建项目默认页面可访问且排版语义更接近原零售模板。

## 6.6.7

## 6.6.6

### Patch Changes

- 🐛 **修复 wevu 与 weapp-vite 在 `v-for` 场景下内联事件对象参数的响应式丢失问题：`@tap="updateQuantity(item, -1)"` 传入的 `item` 会恢复为源列表引用，方法内直接修改对象字段可正确触发视图更新。同时补齐 patch 模式下对 ref/reactive 子根变更的调度与回退映射，避免事件逻辑执行但 UI 不刷新的情况。** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903) by @sonofmagic

## 6.6.5

### Patch Changes

- 🐛 **修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d) by @sonofmagic
  - 同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。

## 6.6.4

### Patch Changes

- 🐛 **chore(依赖)：升级 rolldown 到 1.0.0-rc.4，升级 vite 到 8.0.0-beta.14。** [`5aae454`](https://github.com/weapp-vite/weapp-vite/commit/5aae454c219bbbb5f0ef206f63c9a7d6d42c8248) by @sonofmagic

## 6.6.3

### Patch Changes

- 🐛 **修复 issue #294：当页面默认导出为 `Object.assign(...)` 形态时，`onShareAppMessage` / `onShareTimeline` 在编译阶段未正确注入页面 `features` 的问题。** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a) by @sonofmagic
  本次修复统一了 Vue 脚本重写与页面特性扫描对 `Object.assign` 选项对象的识别逻辑，确保 share hooks 能稳定注入：
  - `enableOnShareAppMessage`
  - `enableOnShareTimeline`

  同时新增对应单元测试，并在 `e2e-apps/github-issues` 中增加 `issue-294` 页面与 e2e 断言，覆盖真实构建产物验证。

- 🐛 **新增 `vue.template.mustacheInterpolation` 配置项，用于统一控制模板 Mustache 输出风格：** [`12e45d5`](https://github.com/weapp-vite/weapp-vite/commit/12e45d5ed487fce4f28d727ed1618250129de5ab) by @sonofmagic
  - `compact`（默认）：输出 `{{expr}}`
  - `spaced`：输出 `{{ expr }}`

  该选项会作用于 Vue 模板编译与 JSX/TSX 模板编译中的主要 Mustache 产物位置（如插值文本、动态属性、`v-if`/`v-else-if`、`v-for`、slot 相关元属性等）。默认行为保持不变。

  同时保留并兼容 `vue.template.objectLiteralBindMode`：
  - `runtime`（默认）：对象字面量 `v-bind` 走运行时中间变量
  - `inline`：对象字面量直接内联输出

  在 `compact + inline` 下，对象字面量会输出为 `{{ { ... } }}`，用于规避 `{{{` 连续花括号在部分小程序编译链路下的兼容性问题。

- 🐛 **新增 `vue.template.objectLiteralBindMode` 配置项，用于控制对象字面量 `v-bind` 的产物模式：** [`dac5c9f`](https://github.com/weapp-vite/weapp-vite/commit/dac5c9fbd8dbc96e40619aab5f3c38287bf57699) by @sonofmagic
  - `runtime`（默认）：保持现有行为，使用运行时中间变量（如 `__wv_bind_0`）
  - `inline`：直接内联对象字面量，并输出为 `{{ { ... } }}`（插值两侧补空格，避免出现 `{{{`）

  这可以兼容旧项目在小程序端对连续三个花括号的编译限制，同时默认行为保持不变。

## 0.1.2

### Patch Changes

- 🐛 **fix object-literal component prop binding in template compilation** [`4ea5edc`](https://github.com/weapp-vite/weapp-vite/commit/4ea5edc17db281bf3167620906d1a27f91be3a1a) by @sonofmagic
  - 修复组件属性 `:prop="{ ... }"` 在小程序模板中生成非法属性表达式的问题
  - 将顶层对象字面量绑定下沉到运行时 `__wv_bind_*` 计算属性
  - 新增 `e2e-apps/object-literal-bind-prop` 与对应 e2e 回归测试

## 0.1.1

### Patch Changes

- 🐛 **fix class/style runtime stability for dynamic class expressions and scoped-slot v-for cases** [`2be2749`](https://github.com/weapp-vite/weapp-vite/commit/2be27498a498fb1e85c5533cc521eb42bdad2ba8) by @sonofmagic
  - 为 class/style 的 JS 运行时计算增加表达式异常保护，避免在 `v-if` 守卫与列表项暂不可用时中断渲染
  - 修复 scoped slot 虚拟模块在 class 计算代码中缺失 `unref` 导入的问题
  - 补充相关单元测试与 e2e 回归用例，覆盖 `v-for` 动态 class 与 `root.a` 这类场景

## 0.1.0

### Minor Changes

- ✨ **将 Vue 模板 `:class` / `:style` 的默认运行时从 `auto` 调整为 `js`，减少“WXS 模式下表达式级回退到 JS”带来的行为分岔，提升不同表达式形态下的一致性与可预期性。** [`65f9f13`](https://github.com/weapp-vite/weapp-vite/commit/65f9f131549181dcb23ac3f2767970663bd6c3c7) by @sonofmagic
  同时保留 `auto` / `wxs` 可选策略：
  - `auto` 仍会在平台支持 WXS 时优先使用 WXS，否则回退 JS。
  - `wxs` 在平台不支持时仍会回退 JS 并输出告警。

  更新了对应的配置类型注释与文档示例，明确默认值为 `js`。

## 0.0.7

### Patch Changes

- 🐛 **fix: 支持小程序事件修饰符 `.stop` 并完善修饰符校验与测试矩阵。** [`eef1eec`](https://github.com/weapp-vite/weapp-vite/commit/eef1eec1a5d73feaa8e82a74ebf4b5d7270159aa) by @sonofmagic
  - 模板编译器将 `@tap.stop` 视为阻止冒泡语义，输出 `catchtap`（含捕获组合输出 `capture-catch:tap`）。
  - WXML 扫描链路同步支持 `.stop`，与 `.catch/.capture/.mut` 前缀决策保持一致。
  - ESLint `vue/valid-v-on` 放行 weapp 场景常用修饰符，避免 `@tap.catch/@tap.mut/@tap.capture` 误报。
  - 补充编译与扫描单元测试矩阵，覆盖 `stop/catch/capture/mut` 及与 Vue 常见修饰符组合场景。

- 🐛 **fix: 修复模板事件修饰符在小程序平台的事件前缀映射。** [`f4acdd8`](https://github.com/weapp-vite/weapp-vite/commit/f4acdd873496eb94b67bc1531434f6064e5f71a1) by @sonofmagic
  - Vue 模板编译新增 `@tap.catch`、`@tap.capture`、`@tap.capture.catch`、`@tap.mut` 的事件前缀识别与转换。
  - 微信/抖音/百度平台按修饰符输出 `catchtap`、`capture-bind:tap`、`capture-catch:tap`、`mut-bind:tap`。
  - 支付宝平台保持对应语义输出 `catchTap`、`captureTap`、`captureCatchTap`，并补充多平台矩阵测试覆盖。

## 0.0.6

### Patch Changes

- 🐛 **fix: 修复 class/style helper 在微信与支付宝脚本模块语法差异下的兼容回归。** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6) by @sonofmagic
  - `@wevu/compiler` 的 class/style helper 改为按脚本扩展名分支生成：
    - `.wxs` 保持 `module.exports`、`Array.isArray` 与 `String.fromCharCode` 路径，恢复微信端行为。
    - `.sjs` 继续使用 `export default`，并避免 `Array` / `String.fromCharCode` 等在支付宝 SJS 下受限的标识符。
  - `weapp-vite` 补充对应单测断言，分别覆盖 `wxs` 与 `sjs` helper 输出约束。
  - 在 `e2e-apps/wevu-runtime-e2e` 新增 `pages/class-style/index.vue`，补充 class/style 多形态绑定示例，并同步 `weapp/alipay/tt` e2e 快照，防止后续回归。

- 🐛 **fix: 修复支付宝 SJS 运行时对 `Array` 标识符的兼容问题。** [`b854454`](https://github.com/weapp-vite/weapp-vite/commit/b8544544227c1212ced1756d17115a1cd76a5578) by @sonofmagic
  - `class/style` 运行时辅助脚本不再使用 `Array.isArray`，改为通过 `Object.prototype.toString` 判断数组。
  - `hyphenate` 不再依赖 `String.fromCharCode`，改为 `charAt(i).toLowerCase()`，降低 SJS 语法限制下的风险。
  - 增加对应测试断言，确保后续不会再次生成含 `Array` 标识符的 SJS 辅助代码。

- 🐛 **fix(alipay): 按脚本扩展名生成 class/style helper 导出语法。** [`ba941e7`](https://github.com/weapp-vite/weapp-vite/commit/ba941e77e8dceaba9ba8acc9ecec0acc348604b1) by @sonofmagic
  - 当 helper 输出为 `.sjs` 时，使用 `export default` 导出，避免支付宝 SJS 对 `module` 标识符限制导致的编译错误。
  - 当 helper 输出为 `.wxs` 时，继续使用 `module.exports`，保持微信等平台兼容行为不变。
  - weapp-vite 在发出 class/style helper 时，改为显式传入当前脚本扩展名，确保不同平台走对应导出策略。
- 📦 **Dependencies** [`7f1a2b5`](https://github.com/weapp-vite/weapp-vite/commit/7f1a2b5de1f22d5340affc57444f7f01289fa7b4)
  → `rolldown-require@2.0.6`

## 0.0.5

### Patch Changes

- 📦 **Dependencies** [`b15f16f`](https://github.com/weapp-vite/weapp-vite/commit/b15f16f9cc1c3f68b8ec85f54dcd00ccfe389603)
  → `rolldown-require@2.0.5`

## 0.0.4

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@weapp-core/shared@3.0.1`, `rolldown-require@2.0.4`

## 0.0.3

### Patch Changes

- 🐛 **升级多处依赖版本（Babel 7.29、oxc-parser 0.112、@vitejs/plugin-vue 6.0.4 等）。** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628) by @sonofmagic
  - 同步模板与示例的 tdesign-miniprogram、weapp-tailwindcss、autoprefixer 等版本，确保脚手架默认依赖一致。
- 📦 **Dependencies** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628)
  → `rolldown-require@2.0.3`

## 0.0.2

### Patch Changes

- 📦 **Dependencies** [`0f4dcbf`](https://github.com/weapp-vite/weapp-vite/commit/0f4dcbf91630b3c0222ac5602b148ee5d500dd17)
  → `rolldown-require@2.0.2`

## 0.0.1

### Patch Changes

- 🐛 **将 Vue SFC 与 wevu 编译逻辑迁移到 `@wevu/compiler`，由 `wevu/compiler` 统一导出，`weapp-vite` 改为使用新编译器入口并清理重复实现。** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce) by @sonofmagic
