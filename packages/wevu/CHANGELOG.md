# wevu

## 6.7.3

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.7.3`

## 6.7.2

### Patch Changes

- 📦 **Dependencies** [`41b049f`](https://github.com/weapp-vite/weapp-vite/commit/41b049f6bca3cd870343dd5b515597075e0c1686)
  → `@wevu/compiler@6.7.2`

## 6.7.1

### Patch Changes

- 🐛 **修复在 `setup()` 返回 `getCurrentSetupContext()` 时可能进入 `setData` 快照并触发递归爆栈的问题，同时补充对应回归测试，并将 composition api 的 weapp e2e 用例拆分为可单独执行的页面级 case。** [`8b76120`](https://github.com/weapp-vite/weapp-vite/commit/8b761206940c4e99c1f65b3663898660f448714d) by @sonofmagic

- 🐛 **本次变更主要修复了三类一致性与可维护性问题：一是 `wevu` 构建默认产物此前仅压缩且缺少 sourcemap，不利于排查线上问题，现调整为输出 sourcemap 以提升调试可观测性；二是 `weapp-vite` 侧 `oxc-parser` 与类型依赖升级到同一版本，降低 AST 解析与类型不匹配带来的潜在风险；三是同步更新 workspace catalog 与 `create-weapp-vite` 生成 catalog，避免模板初始化时依赖版本与仓库主线不一致。** [`17f30b1`](https://github.com/weapp-vite/weapp-vite/commit/17f30b169337d5bc015a46841807f964cc1e140f) by @sonofmagic
- 📦 **Dependencies** [`662630e`](https://github.com/weapp-vite/weapp-vite/commit/662630e7c12e49bf783d7e728618fbbad863ff3b)
  → `@wevu/compiler@6.7.1`

## 6.7.0

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.7.0`

## 6.6.16

### Patch Changes

- 📦 **Dependencies** [`a1ae4a6`](https://github.com/weapp-vite/weapp-vite/commit/a1ae4a6abe0374644a32d0078085bd662faae641)
  → `@wevu/compiler@6.6.16`

## 6.6.15

### Patch Changes

- 🐛 **修复 `wevu` 在小程序运行时 `setData` 快照与下发 payload 的引用污染问题：当 `computed` 返回对象并在模板读取其属性时，切换到其他引用再切回初始引用会被错误判定为未变化。现在会在内部快照与 `setData` 下发前做隔离拷贝，确保 `option.label` 这类绑定在引用往返后仍能正确更新。** [`da5b206`](https://github.com/weapp-vite/weapp-vite/commit/da5b20637dda06f67207f36952ef4115005456dd) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.6.15`

## 6.6.14

### Patch Changes

- 📦 **Dependencies** [`39227de`](https://github.com/weapp-vite/weapp-vite/commit/39227de97e3d6e4e1f82b14a6ce5e8bce918b0d9)
  → `@wevu/compiler@6.6.14`

## 6.6.13

### Patch Changes

- 🐛 **修复 `wevu` 组件侧 `pageLifetimes.routeDone` 的生命周期桥接，确保在组件中可通过 `onRouteDone` 正常接收页面路由动画完成事件；同步补齐相关运行时测试与文档映射说明（`lifetimes/pageLifetimes` 与组合式 API 的对应关系），避免与微信官方生命周期定义不一致。** [`6742994`](https://github.com/weapp-vite/weapp-vite/commit/6742994ffd0a3c522d1e527e0d90e4863a2d853c) by @sonofmagic

- 🐛 **优化 Wevu API 文档的公开边界：移除 API 页面中不应面向业务侧展示的内部接口，并在运行时源码中为内部能力补充 `@internal` 标注；同时将 `provideGlobal` / `injectGlobal` 标记为 `@deprecated`（保留导出用于兼容过渡），统一文档与实际导出语义，降低误用内部能力的风险。** [`c7f37ac`](https://github.com/weapp-vite/weapp-vite/commit/c7f37acc6cab3acc8cef50154f840ef71cc42cb4) by @sonofmagic

- 🐛 **对齐 `wevu` 对外 `PropType<T>` 的类型行为到 Vue 官方定义，支持 `type: [String, null]` 等构造器数组写法，并修复该场景下 `InferPropType` 对 `null` 推导退化为 `any` 的问题，保证与 Vue utility types 的使用体验一致。** [`86c7300`](https://github.com/weapp-vite/weapp-vite/commit/86c73009267c18219b2dfbf5772e7f182827cbbd) by @sonofmagic
- 📦 **Dependencies** [`ebdd313`](https://github.com/weapp-vite/weapp-vite/commit/ebdd313e94ebcbc0570b9bf1b44c2e403423d45a)
  → `@wevu/compiler@6.6.13`

## 6.6.12

### Patch Changes

- 🐛 **新增原生组件 `properties` 类型推导工具：`InferNativePropType`、`InferNativeProps`、`NativePropType`、`NativeTypeHint`、`NativeTypedProperty`，并在 `wevu-vue-demo` 与文档中补充 `script setup` 直接导入原生组件的推荐写法。现在可基于 `properties` 作为单一数据源生成 props 类型，并通过 `NativePropType<T>`（类似 Vue `PropType<T>`）为联合字面量提供更简洁的类型提示，减少手写接口与重复断言。** [`788a4e0`](https://github.com/weapp-vite/weapp-vite/commit/788a4e080a95524207754bd29316a1504c26b195) by @sonofmagic

- 🐛 **新增 `NativeComponent<Props>` 类型导出，用于简化原生小程序组件在 `script setup` 场景下的类型包装写法；同时补充 `wevu-vue-demo` 原生组件示例（含 `TS + SCSS` 版本）与对应页面引入演示，使原生组件 `props` 在模板中的智能提示与类型约束更稳定、易用。** [`ad8c631`](https://github.com/weapp-vite/weapp-vite/commit/ad8c631f7d1aa19e9f3ac70e5ddc68eb116862ef) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.6.12`

## 6.6.11

### Patch Changes

- 🐛 **修复同一节点绑定多个事件时的 inline 事件冲突：编译器为不同事件生成按事件名分片的 dataset 键（如 `data-wv-inline-id-tap`），运行时按 `event.type` 读取对应键并保持兼容回退。补充组件 `emit` 与 `$event` 的单元测试和 e2e 覆盖，并在 `wevu-vue-demo` 的 `vue-compat/template` 页面新增单节点多事件（参数 + `$event`）示例。** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509) by @sonofmagic

- 🐛 **导出 `customRef` 及其相关类型声明，完善 `wevu` 对 Vue 3 响应式 API 的可用性。同步扩展 `wevu-vue-demo` 的 `vue-compat` 响应式对照页，新增多源 watch cleanup、watchEffect 句柄控制、effectScope 生命周期、customRef 去抖、shallowReactive/markRaw/toRef 等复杂案例，并补齐能力矩阵与说明文档，确保 typecheck、eslint、stylelint 与 build 全量通过。** [`f881fd9`](https://github.com/weapp-vite/weapp-vite/commit/f881fd90a8a7501550c5a9bf448f810265c205ae) by @sonofmagic

- 🐛 **为 `defineModel` 增加 Vue 3 兼容的 tuple + modifiers 类型与运行时能力：支持 `const [model, modifiers] = defineModel()` 与修饰符泛型推导；同时扩展 `useModel` 的 get/set 选项以适配基于 modifiers 的值转换。补充 `tsd` 类型测试、运行时测试与 `weapp-vite` 的脚本编译测试，并同步更新 `wevu-vue-demo` 的 script-setup 兼容示例与矩阵结论。** [`fd5f8ce`](https://github.com/weapp-vite/weapp-vite/commit/fd5f8ce6bc23d106b43de524ac12d0cc10221c98) by @sonofmagic

- 🐛 **修复组件自定义事件在模板监听中的 `$event` 语义：编译期为组件事件注入 `data-wv-event-detail` 并将简单处理器按 inline 路径编译，运行时据此将 `$event` 解析为 `event.detail`，避免出现 `emit: undefined @ undefined`。同时补充 `wevu-vue-demo` 的 `$event` 上抛示例，并新增编译器、运行时与 e2e 集成测试覆盖。** [`e2aa20e`](https://github.com/weapp-vite/weapp-vite/commit/e2aa20e1cf79b4c5c3c36735b967c6fd5583486f) by @sonofmagic

- 🐛 **对 `wevu` 的 `ref` 类型声明进行兼容增强，新增无参重载以对齐 Vue 3 的使用习惯，并补充对应的类型测试覆盖。同步更新 `wevu-vue-demo` 示例，统一模板为 Vue 语法（`v-for` / `v-if` / `@tap` 等），修复 demo 中现存的 `vue-tsc` 与 eslint 问题，并将 Volar 模板类型库显式切换到 `wevu`，使小程序内置标签类型跳转指向 `wevu` 的 intrinsic elements 声明。** [`31e2db3`](https://github.com/weapp-vite/weapp-vite/commit/31e2db3337842e5fafee21d2d741b8f71643197d) by @sonofmagic
- 📦 **Dependencies** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509)
  → `@wevu/compiler@6.6.11`

## 6.6.10

### Patch Changes

- 🐛 **修复 `wevu` 运行时的多平台条件裁剪链路：统一通过 `import.meta.env.PLATFORM` 选择小程序全局对象（`tt/my/wx`），并将相关 runtime 入口（组件定义、App 注册、hooks、template refs、页面生命周期）改为走平台适配层，避免非目标平台分支进入最终产物。同时补充 `weapp-vite` npm 构建 define 透传与 e2e 覆盖，分别验证 `wevu` 位于 `devDependencies` 与 `dependencies` 时的构建行为与平台输出。** [`b248a4a`](https://github.com/weapp-vite/weapp-vite/commit/b248a4a6e04dc12dd190fa1b29b615191ed3be87) by @sonofmagic

- 🐛 **修复 `wevu` 运行时在 Node 环境加载时对 `import.meta.env.PLATFORM` 的直接读取问题：当 `import.meta.env` 不存在（如单元测试加载 `vite.config.ts`）时不再抛出异常，改为安全访问并继续走平台兜底逻辑，避免 `Cannot read properties of undefined (reading 'PLATFORM')` 导致构建/测试提前失败。** [`e6c326f`](https://github.com/weapp-vite/weapp-vite/commit/e6c326f64989ae4f0af40553405af19fb1e74f7d) by @sonofmagic

- 🐛 **补齐 `wevu` 在 Vue `<script setup>` 中 `defineProps/defineEmits` 的类型兼容能力：`defineEmits` 现已支持数组、对象、函数重载与命名元组写法，并对齐官方 `EmitFn` 推导行为；同时增强运行时 `ctx.emit`，兼容 `emit(event, ...args)` 多参数形式并按小程序 `triggerEvent` 规范化 `detail/options`。另外新增 `wevu` 与 `weapp-vite` 的类型/编译回归测试，覆盖这些写法的编译与类型校验链路。** [`3a7f4fe`](https://github.com/weapp-vite/weapp-vite/commit/3a7f4fe3e5dbedf6b7c6f09d0cb52e3f4871a792) by @sonofmagic

- 🐛 **修复 `wevu` 组件类型暴露导致的模板补全噪声问题：`defineComponent` 的公开返回类型不再把内部运行时字段作为可补全属性暴露，避免在 Vue SFC 中出现 `:__wevu_options`、`:__wevu_runtime` 及 symbol 序列化键提示。同时同步更新 `lib-mode` 的类型断言用例，确保构建产物导出的组件类型与新的公开契约保持一致。** [`db18a6a`](https://github.com/weapp-vite/weapp-vite/commit/db18a6a9ebd24252128d152190316b525db53380) by @sonofmagic

- 🐛 **修复 `wevu` 在 `createApp().mount()` 返回值上的类型冲突：`RuntimeInstance` 不再在对象字面量直接声明内部字段 `__wevu_touchSetupMethodsVersion`，改为运行时按不可枚举属性注入，消除 TypeScript 报错且不暴露内部实现细节。同步补充并修正 `tsd` 类型测试，覆盖 `RuntimeInstance` 的 `state/computed/methods/proxy/watch/bindModel` 推导行为，以及内部字段不可访问约束，确保类型契约在构建与消费场景下稳定。** [`4f1ebb6`](https://github.com/weapp-vite/weapp-vite/commit/4f1ebb63da9035f5777796ab371fae9db4c7a73f) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@6.6.10`

## 6.6.9

### Patch Changes

- 📦 **Dependencies** [`b6f2e49`](https://github.com/weapp-vite/weapp-vite/commit/b6f2e49c5a4642037b23feb2d1764e5915005869)
  → `@wevu/compiler@6.6.9`

## 6.6.8

### Patch Changes

- 🐛 **修复 `defineProps` 布尔类型在模板调用表达式（如 `String(bool)`）中的运行时绑定结果为 `undefined` 的问题（#300）。编译器现在会对模板运行时绑定标识符增加 `__wevuProps` 回退读取逻辑；运行时则预置并复用响应式 `__wevuProps` 容器，确保计算属性首次求值即可建立正确依赖并在 props 变更时稳定更新。** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de) by @sonofmagic
  - 同时补充对应的编译回归测试与运行时同步测试，覆盖 `script setup` 的 props 解构场景。

- 🐛 **修复 issue #300 场景下 `String(props.bool)` 在组件交互后不响应变更的问题，避免生成 `__wevuProps.props` 访问路径，并完善 props 同步与同名 setup 绑定的运行时处理及 e2e 回归测试。** [`9b2c623`](https://github.com/weapp-vite/weapp-vite/commit/9b2c623d7a6ca0b254ad55cc9a392ea8058e1141) by @sonofmagic

- 🐛 **修复 issue #300 场景下 `<script setup>` 中仅使用 `defineProps` 类型声明且未声明 `props` 变量时，模板调用表达式（如 `String(bool)`）在小程序运行时出现初始值错误或 props 变更后不响应的问题，并补充对应的构建与 IDE 端到端回归测试。** [`253fc99`](https://github.com/weapp-vite/weapp-vite/commit/253fc99ee8179e43c0ea96dded4773eed52c7663) by @sonofmagic

- 🐛 **修复 `wevu` 模板编译在小程序端对可选链表达式（`?.`）的兼容性问题：在模板编译阶段将 `?.` 安全降级为条件表达式，避免产物 WXML 在微信开发者工具中出现语法报错，并补充对应编译测试与集成测试覆盖。** [`3f1253e`](https://github.com/weapp-vite/weapp-vite/commit/3f1253e5bd1dbb320566e869d172048c63265a56) by @sonofmagic
  - 同时对 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 进行路由与页面结构对齐：同步主包与分包路由配置至 `tdesign-miniprogram-starter-retail`，补齐自定义 `tabBar` 形态，并将页面壳改为按路由渲染对应版式（如首页、分类、购物车、商品详情、订单列表与表单页等），确保新建项目默认页面可访问且排版语义更接近原零售模板。
- 📦 **Dependencies** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de)
  → `@wevu/compiler@6.6.8`

## 6.6.7

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@6.6.7`

## 6.6.6

### Patch Changes

- 🐛 **修复 wevu 与 weapp-vite 在 `v-for` 场景下内联事件对象参数的响应式丢失问题：`@tap="updateQuantity(item, -1)"` 传入的 `item` 会恢复为源列表引用，方法内直接修改对象字段可正确触发视图更新。同时补齐 patch 模式下对 ref/reactive 子根变更的调度与回退映射，避免事件逻辑执行但 UI 不刷新的情况。** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903) by @sonofmagic
- 📦 **Dependencies** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903)
  → `@wevu/compiler@6.6.6`

## 6.6.5

### Patch Changes

- 🐛 **修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d) by @sonofmagic
  - 同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。
- 📦 **Dependencies** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d)
  → `@wevu/compiler@6.6.5`

## 6.6.4

### Patch Changes

- 🐛 **fix(wevu)：修复 store `direct` 通知在订阅回调内二次修改状态时可能出现的重入更新风暴问题，避免小程序模拟器长时间无响应；同时补充 `wevu-features` 的 `use-store` 能力展示与对应 e2e 回归覆盖，提升交互稳定性与可验证性。** [`8d2d7f7`](https://github.com/weapp-vite/weapp-vite/commit/8d2d7f7e72d3da5a10fa14e5b66370f739eaf752) by @sonofmagic

- 🐛 **docs(wevu)：补充 wevu 特性展示与 e2e 覆盖，并明确 `useAttrs`、`useSlots`、`defineSlots` 在小程序平台的兼容边界与使用建议。** [`05e5517`](https://github.com/weapp-vite/weapp-vite/commit/05e55174e73c93c69bc28f6d651841161697a425) by @sonofmagic

- 🐛 **fix(wevu)：修复组件 attrs 同步会混入运行时 state 字段的问题，避免 attrs 透传被内部字段污染；同时将 runtime e2e 页面中的 `<text selectable>` 调整为 `user-select` 以消除平台弃用告警。** [`8916fc1`](https://github.com/weapp-vite/weapp-vite/commit/8916fc121800ad0da417cfe1e584b33d20094cc7) by @sonofmagic

- 🐛 **fix(wevu)：修复 runtime watch 停止句柄与注册流程的类型不一致问题，清理小程序全局对象与生命周期补丁的 TS 报错，并补全对外 API 的 tsd 与导出覆盖测试。** [`3af0847`](https://github.com/weapp-vite/weapp-vite/commit/3af0847c326a374cddd1bed283a1f24c4a2358ba) by @sonofmagic
- 📦 **Dependencies** [`5aae454`](https://github.com/weapp-vite/weapp-vite/commit/5aae454c219bbbb5f0ef206f63c9a7d6d42c8248)
  → `@wevu/compiler@6.6.4`

## 6.6.3

### Patch Changes

- 🐛 **修复 issue #294：当页面默认导出为 `Object.assign(...)` 形态时，`onShareAppMessage` / `onShareTimeline` 在编译阶段未正确注入页面 `features` 的问题。** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a) by @sonofmagic
  本次修复统一了 Vue 脚本重写与页面特性扫描对 `Object.assign` 选项对象的识别逻辑，确保 share hooks 能稳定注入：
  - `enableOnShareAppMessage`
  - `enableOnShareTimeline`

  同时新增对应单元测试，并在 `e2e-apps/github-issues` 中增加 `issue-294` 页面与 e2e 断言，覆盖真实构建产物验证。

- 📦 **Dependencies** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a)
  → `@wevu/compiler@6.6.3`

## 2.1.11

### Patch Changes

- 📦 **Dependencies** [`4ea5edc`](https://github.com/weapp-vite/weapp-vite/commit/4ea5edc17db281bf3167620906d1a27f91be3a1a)
  → `@wevu/compiler@0.1.2`

## 2.1.10

### Patch Changes

- 📦 **Dependencies** [`2be2749`](https://github.com/weapp-vite/weapp-vite/commit/2be27498a498fb1e85c5533cc521eb42bdad2ba8)
  → `@wevu/compiler@0.1.1`

## 2.1.9

### Patch Changes

- 📦 **Dependencies** [`65f9f13`](https://github.com/weapp-vite/weapp-vite/commit/65f9f131549181dcb23ac3f2767970663bd6c3c7)
  → `@wevu/compiler@0.1.0`

## 2.1.8

### Patch Changes

- 🐛 **fix: 修复 WeappIntrinsicElements 属性合并导致 `id` 推断为 `undefined` 的问题。** [`24f4d06`](https://github.com/weapp-vite/weapp-vite/commit/24f4d06d09986d48a56660d04481e44bb68afe5a) by @sonofmagic
  - 生成器跳过与基础属性（`id/class/style/hidden`）同名的组件属性，避免交叉类型冲突。
  - 基础属性 `id` 调整为 `string | number`，使 `map` 等场景可同时接收字符串与数字。
  - 补充 `tsd` 回归测试，验证 `WeappIntrinsicElements['map']['id']` 为 `string | number | undefined`。
- 📦 **Dependencies** [`eef1eec`](https://github.com/weapp-vite/weapp-vite/commit/eef1eec1a5d73feaa8e82a74ebf4b5d7270159aa)
  → `@wevu/compiler@0.0.7`

## 2.1.7

### Patch Changes

- 🐛 **fix: 修复 class/style helper 在微信与支付宝脚本模块语法差异下的兼容回归。** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6) by @sonofmagic
  - `@wevu/compiler` 的 class/style helper 改为按脚本扩展名分支生成：
    - `.wxs` 保持 `module.exports`、`Array.isArray` 与 `String.fromCharCode` 路径，恢复微信端行为。
    - `.sjs` 继续使用 `export default`，并避免 `Array` / `String.fromCharCode` 等在支付宝 SJS 下受限的标识符。
  - `weapp-vite` 补充对应单测断言，分别覆盖 `wxs` 与 `sjs` helper 输出约束。
  - 在 `e2e-apps/wevu-runtime-e2e` 新增 `pages/class-style/index.vue`，补充 class/style 多形态绑定示例，并同步 `weapp/alipay/tt` e2e 快照，防止后续回归。

- 🐛 **fix(alipay): 避免运行时直接访问 `globalThis` 导致支付宝端报错。** [`aabec69`](https://github.com/weapp-vite/weapp-vite/commit/aabec69b7e543d092113b377af1a552d623553e5) by @sonofmagic
  - wevu 运行时在自动注册 App、页面生命周期补丁与 scoped-slot 全局注入场景，改为优先使用小程序全局对象（`wx`/`my`），避免在关键路径直接访问 `globalThis`。
  - 修复支付宝模拟器中 `ReferenceError: globalThis is not defined`，兼容不提供 `globalThis` 的运行环境。
- 📦 **Dependencies** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6)
  → `@wevu/compiler@0.0.6`

## 2.1.6

### Patch Changes

- 🐛 **lib 模式默认生成 dts，支持 .vue/wevu SFC，并修复 rolldown dts 输出命名冲突；新增 internal 模式生成 Vue SFC dts（vue-tsc 作为可选后备），同时导出 WevuComponentConstructor 以保障声明生成。** [`7ac4a68`](https://github.com/weapp-vite/weapp-vite/commit/7ac4a688e88e21192cf0806ca041db0773ac3506) by @sonofmagic
- 📦 **Dependencies**
  → `@wevu/compiler@0.0.5`

## 2.1.5

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@wevu/compiler@0.0.4`

## 2.1.4

### Patch Changes

- 📦 **Dependencies** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628)
  → `@wevu/compiler@0.0.3`

## 2.1.3

### Patch Changes

- 📦 **Dependencies**
  → `@wevu/compiler@0.0.2`

## 2.1.2

### Patch Changes

- 🐛 **将 Vue SFC 与 wevu 编译逻辑迁移到 `@wevu/compiler`，由 `wevu/compiler` 统一导出，`weapp-vite` 改为使用新编译器入口并清理重复实现。** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce) by @sonofmagic

- 🐛 **为 wevu 的 watch/watchEffect 增加 pause 与 resume 能力，同时保持 stop 旧用法兼容。** [`d54d430`](https://github.com/weapp-vite/weapp-vite/commit/d54d430a93b8045f91ab1a16b2501dceda10a824) by @sonofmagic

- 🐛 **修复 watch/watchEffect 在同一微任务内重复触发的问题，确保调度去重生效。** [`7fc02cd`](https://github.com/weapp-vite/weapp-vite/commit/7fc02cd1fb7858358445b07bfd24f443b1a99ad3) by @sonofmagic
- 📦 **Dependencies** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce)
  → `@wevu/compiler@0.0.1`

## 2.1.1

### Patch Changes

- 🐛 **支持内联事件参数使用动态表达式，并兼容小程序侧数组参数传递。** [`8940c7f`](https://github.com/weapp-vite/weapp-vite/commit/8940c7fd87b6153137ca9b33b8d0925a4b592c4e) by @sonofmagic

- 🐛 **支持内联事件表达式在编译期生成执行器，保证复杂参数调用在小程序运行时可用。** [`9c90f7b`](https://github.com/weapp-vite/weapp-vite/commit/9c90f7b6777374aaf54ee4b5955a4b01209acc0f) by @sonofmagic

- 🐛 **修复内联事件表达式执行器在运行时读取不到 inline map 的问题，确保模板事件可正常触发。** [`fc5657e`](https://github.com/weapp-vite/weapp-vite/commit/fc5657e7c66c4150aba47829b48f5d38f797d797) by @sonofmagic

- 🐛 **修复组件化页面生命周期补触发逻辑，补齐下拉刷新/滚动事件，并避免生命周期日志丢失。** [`26bc05b`](https://github.com/weapp-vite/weapp-vite/commit/26bc05b47852aaf07c45e7528c60269dc36d1d9b) by @sonofmagic

## 2.1.0

### Minor Changes

- ✨ **新增组件选项 `setupLifecycle`（`created` / `attached`），并将默认执行时机改为 `attached`，以便 setup 拿到外部传入的 props；同时 weapp-vite 类型对齐该配置。** [`5c42bd3`](https://github.com/weapp-vite/weapp-vite/commit/5c42bd34cac020dc6d6bd094b6b45e78cdb6a53c) by @sonofmagic

## 2.0.2

### Patch Changes

- 🐛 **补全 button 的 open-type 枚举与事件类型，并补充单元测试和 tsd 覆盖。** [`a6e3ba8`](https://github.com/weapp-vite/weapp-vite/commit/a6e3ba8be6c22dcfbf2edbfa9c977f8a39aef119) by @sonofmagic

- 🐛 **按组件拆分 weappIntrinsicElements 输出文件，并为每个组件文件补充文档链接注释。** [`d160032`](https://github.com/weapp-vite/weapp-vite/commit/d16003262a212070f1547db80ab2b7f7aecb8a83) by @sonofmagic

## 2.0.1

### Patch Changes

- 🐛 **对齐 `watch`/`watchEffect` 的 `flush`/`scheduler`/`once`/`deep:number` 行为与类型，并补充 `traverse` 分支覆盖；修复 rolldown-require 的类型构建错误。** [`28ea55d`](https://github.com/weapp-vite/weapp-vite/commit/28ea55d72429fd416502d80fa9819c099fe16dd3) by @sonofmagic

## 2.0.0

### Major Changes

- 🚀 **破坏性变更：`setup` 与 Vue 3 对齐，仅支持 `setup(props, ctx)`。请将 `setup(ctx)` 改为 `setup(_, ctx)`。** [`158306b`](https://github.com/weapp-vite/weapp-vite/commit/158306b75191040ecbdef846e66e9f6e49036d19) by @sonofmagic

## 1.3.0

### Minor Changes

- ✨ **新增 `toValue` 与 `MaybeRef`/`MaybeRefOrGetter` 类型对齐 Vue API，补充 tsd 与运行时测试覆盖常见场景。** [`ecf7436`](https://github.com/weapp-vite/weapp-vite/commit/ecf7436d8c22a4827cbb26410eb6153156cfc796) by @sonofmagic

### Patch Changes

- 🐛 **修复 defineComponent 类型在 TypeScript 中的深度实例化问题，并补充 \_\_typeProps 与实例 $props 的类型测试覆盖。** [`705b087`](https://github.com/weapp-vite/weapp-vite/commit/705b087e36a30655a6786597d63c71bce93a1684) by @sonofmagic

## 1.2.1

### Patch Changes

- 🐛 **Miscellaneous improvements** [`775e89d`](https://github.com/weapp-vite/weapp-vite/commit/775e89d64484bc3052204c1ed73a9549d7359093) by @sonofmagic
  - store `$subscribe` 支持直接赋值触发，新增 `mutation.type = direct`。
  - store `$reset` 现在支持 Setup Store，并重置为初始快照。

## 1.2.0

### Minor Changes

- ✨ **简化 wevu 类型构建流程，改用 tsdown 生成声明文件，并补充 vue 依赖。** [`e592907`](https://github.com/weapp-vite/weapp-vite/commit/e59290771ae1f152b421b10e5960d486023ccbb6) by @sonofmagic

## 1.1.4

### Patch Changes

- 🐛 **修复 wevu 无 Vue 依赖时的类型入口，补齐 DefineComponent 默认 props 推导与 ComponentPublicInstance 形态，确保 Volar 能正确解析 SFC props。** [`ff5930b`](https://github.com/weapp-vite/weapp-vite/commit/ff5930b162f79436e74430f2820fa3b7e27a4eed) by @sonofmagic

## 1.1.3

### Patch Changes

- 🐛 **修复类型导出与内联逻辑，确保 wevu 类型文件不再依赖外部 `@vue/*` 包，并补齐 `DefineComponent` 等类型的泛型签名。** [`10ae1ea`](https://github.com/weapp-vite/weapp-vite/commit/10ae1eaa25d4b64f028a0c2eccb8487d19aed5ef) by @sonofmagic

## 1.1.2

### Patch Changes

- 🐛 **修复组件模板 ref 返回值，优先返回 expose/公开实例并自动识别组件 ref。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **新增 useTemplateRef 支持并同步模板 ref 更新逻辑。** [`5eed670`](https://github.com/weapp-vite/weapp-vite/commit/5eed670c559d9d8fd5a5a3f3c963a3e08be75559) by @sonofmagic

- 🐛 **组件模板 ref 同时返回节点查询能力与 expose 成员，避免 ref 丢失 DOM 查询方法。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **调整 onMounted/onReady 触发时机，确保模板 ref 更新完成后再执行。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **修复 defineComponent 类型推导，使组件 ref 能拿到 defineExpose 暴露的实例类型。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

## 1.1.1

### Patch Changes

- 🐛 **新增 Vue SFC 模板 ref 支持，编译期注入 ref 元数据与标记，运行时通过 selectorQuery 绑定与更新。** [`60f19f8`](https://github.com/weapp-vite/weapp-vite/commit/60f19f8bceff0ffdd8668e54b00f6864999e4c5a) by @sonofmagic

## 1.1.0

### Minor Changes

- ✨ **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 1.0.7

### Patch Changes

- 🐛 **将 `<script setup>` 宏类型声明迁移到 `macros.ts`，`index.ts` 仅保留导出结构。** [`be9cdec`](https://github.com/weapp-vite/weapp-vite/commit/be9cdece9b680178b8f1e57d0b945251c9c4fe82) by @sonofmagic

## 1.0.6

### Patch Changes

- 🐛 **修复 watch 对数组源的类型推断，使其与 Vue 3 行为对齐，并完善 useBindModel 在模板中的推荐用法。** [`dc9fcc0`](https://github.com/weapp-vite/weapp-vite/commit/dc9fcc044af51c4d39439064717864f51a1f7aad) by @sonofmagic

## 1.0.5

### Patch Changes

- 🐛 **补齐 class/style 绑定对象/数组在小程序中的 WXS/JS 运行时支持，JS 侧改为编译期 AST 注入以避免 eval/with，并新增相关单测覆盖。** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74) by @sonofmagic

- 🐛 **为 WXML 基础属性补充 `id`、`class`、`style`、`hidden` 的 JSX 提示。** [`10aa821`](https://github.com/weapp-vite/weapp-vite/commit/10aa821610e49c4a785446af162ad837cc905926) by @sonofmagic

- 🐛 **补充内置小程序 JSX 属性类型：class/style 对齐 Vue 语义，并支持 `data-*` dataset 声明。** [`eafbe3e`](https://github.com/weapp-vite/weapp-vite/commit/eafbe3ecfc325dc7fd910ee7e353e0a3cfcf3801) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **docs: 补充 wevu 宏指令中文注释与用法示例** [`fcb8d6a`](https://github.com/weapp-vite/weapp-vite/commit/fcb8d6a13e501880cc976409f372518002f3229e) by @sonofmagic

- 🐛 **修复 autoImportComponents 生成的导航路径优先指向 `.d.ts`，避免组件类型在 Volar 中退化为 `any`。** [`fe23c0e`](https://github.com/weapp-vite/weapp-vite/commit/fe23c0e2f191f3b7b2043cd3e30afe07c0b7df69) by @sonofmagic
  - 补充 wevu 宏指令的中文说明与示例，完善类型提示使用说明。 调整 wevu `jsx-runtime` 的 `IntrinsicElements` 以继承 `GlobalComponents`，让小程序组件标签能正确推断属性类型。

## 1.0.3

### Patch Changes

- 🐛 **修复响应式相关问题：** [`4f5b4d4`](https://github.com/weapp-vite/weapp-vite/commit/4f5b4d43b0a604f901b27eb143b2a63ed7049f11) by @sonofmagic
  - `triggerEffects` 迭代时复制依赖集合，避免自触发死循环
  - `triggerRef` 直接触发依赖，确保在值不变时也能更新
  - `watch` 监听 reactive 源时默认走 deep 策略，保持行为一致

## 1.0.2

### Patch Changes

- 🐛 **性能：调度器避免同一 tick 内重复安排 flush；diff 避免递归创建 key set，减少 GC 压力。** [`29d8996`](https://github.com/weapp-vite/weapp-vite/commit/29d899694f0166ffce5d93b8c278ab53d86ced1e) by @sonofmagic
  - 优化：支持通过 `setData` 选项控制快照字段与是否包含 computed，降低 setData 体积与快照开销。
  - 优化：新增 `setData.strategy = "patch"`，按变更路径增量生成 setData payload（在共享引用等场景会自动回退到 diff）。
  - 优化：patch 模式预先建立对象路径索引，减少“路径未知导致回退 diff”的概率；数组内部对象变更会回退到数组整体替换。
  - 优化：patch 模式会合并冗余变更路径（当父路径存在时丢弃子路径），进一步减少 setData payload。
  - 优化：patch 模式对 computed 做“脏 key 收集”，只对变更的 computed 计算与下发，降低开销。
  - 优化：patch 模式支持 `maxPatchKeys/maxPayloadBytes` 阈值，变更路径或 payload 过大时自动回退到 diff。
  - 优化：patch 模式支持 `mergeSiblingThreshold`，当同一父路径下出现多个子路径变更时合并为父路径下发，进一步减少 keys 数与调度开销。
  - 优化：patch 模式优化 `collapsePayload` 与 payload 大小估算，减少不必要的字符串化与分配开销。
  - 优化：patch 模式 computed 下发逻辑优化，减少不必要的 diff 计算与对象分配。
  - 优化：patch 模式支持通过 `computedCompare/computedCompareMaxDepth/computedCompareMaxKeys` 控制 computed 对比开销，避免大对象递归比较过慢。
  - 优化：卸载时清理 patch 模式的内部路径索引，降低长期运行内存占用与索引维护成本。
  - 优化：`collapsePayload` 使用排序 + 前缀栈扫描替代逐层 ancestor 查找，减少路径去重开销。
  - 优化：patch 模式支持 `debug` 回调输出回退原因与 key 数，便于调参与定位性能瓶颈。
  - 优化：patch 模式支持 `prelinkMaxDepth/prelinkMaxKeys` 限制预链接开销，避免大 state 初始化卡顿。
  - 优化：同级合并支持 `mergeSiblingMaxInflationRatio/mergeSiblingMaxParentBytes/mergeSiblingSkipArray`，减少“合并反而变大”的负优化。
  - 优化：共享引用等“路径不唯一”场景下，patch 模式尝试回退到受影响的顶层字段整体替换，避免直接全量 diff。
  - 优化：提供 `markNoSetData()` 用于标记值跳过 setData 序列化，提升大对象/SDK 实例的使用体验。
  - 优化：`toPlain` 对 Date/Map/Set/RegExp/Error/ArrayBuffer 等值做宽松序列化，减少不可序列化导致的问题。
  - 修复：`onErrorCaptured` 回调的 instance 参数稳定指向注册时实例。
  - 重构：提炼 `setComputedValue` / `parseModelEventValue` 内部复用函数。

## 1.0.1

### Patch Changes

- 🐛 **移除 `onAppShow/onAppHide/onAppError/onAppLaunch` 等 `onApp*` hooks，App 生命周期统一使用：** [`6f1c4ca`](https://github.com/weapp-vite/weapp-vite/commit/6f1c4cabb30a03f0dc51b11c3aff6fdcbf0e09c9) by @sonofmagic
  - `onLaunch/onShow/onHide/onError/onPageNotFound/onUnhandledRejection/onThemeChange`。
  - 同时将 `onErrorCaptured` 的映射调整为 `onError`。

## 1.0.0

### Major Changes

- 🚀 **## fix-nonserializable-setup-return** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  修复 `setup` 返回非可序列化对象导致小程序端更新栈溢出的问题：
  - 当 `setup/script setup` 返回值中包含小程序实例等复杂对象时，运行时不再将其纳入 `setData` 快照（改为非枚举属性，仅供 JS 侧访问），避免序列化/遍历时出现 `Maximum call stack size exceeded`。

  ## fix-setup-ref-ui-update

  修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

  ## fix-vmodel-and-props-sync-zh

  修复 weapp-vite + wevu 在微信小程序中的两类常见问题：
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

  ## support-script-setup-model-slots

  补齐 Vue `<script setup>` 宏与运行时兼容能力：
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。

  ## unify-wevu-entry

  Store API 统一从主入口导出，并补充 wevu 使用文档与案例合集。

  ## wevu-page-hooks-mapping

  补齐 Page 页面事件 hooks，并增强 `features` 用途：
  - `features` 用于**按需注入**页面事件处理函数（仍保持默认不注入，避免无效事件派发带来的性能与 UI 影响）。当你只在 `setup()` 里注册 hook 时，可通过 `features` 显式开启对应页面事件（例如 `onShareTimeline` 需要在注册阶段存在才会展示菜单按钮）。
  - 新增页面 hooks：`onLoad`、`onPullDownRefresh`、`onReachBottom`。
  - 新增文档 `docs/wevu/page-hooks-mapping.md`，提供 wevu hooks 与原生 Page 生命周期/事件回调的 1:1 对应表。

  ## wevu-reactivity-batch-scope

  新增响应式批处理与作用域能力：
  - 新增 `batch`/`startBatch`/`endBatch`，支持将同一同步批次内的多次状态变更合并触发，减少重复 effect 执行。
  - 新增 `effectScope`/`onScopeDispose`/`getCurrentScope`，并让 `watch`/`watchEffect` 自动注册到作用域中，便于统一销毁与避免内存泄漏。
  - 修复 `watchEffect` 初始化时可能重复执行的问题（现在仅执行一次以建立依赖）。

  ## wevu-tsd-store-typing

  完善 wevu store 的类型推导对齐 Pinia，并补齐 tsd 测试覆盖。

  ## zh-auto-wevu-page-features

  weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

  ## zh-improve-wevu-notes

  完善 wevu 运行时的健壮性与中文注释：补齐 runtime methods/state 兜底避免空指针，同时为响应式、生命周期、store 等源码补充详细中文说明，方便阅读和调试。

  ## zh-slot-template-blocks-and-multiple-slots

  优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

  ## zh-wevu-component-lifetimes-hooks

  补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：
  - wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
  - 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

  ## zh-wevu-component-only-pages

  wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

## 1.0.0-alpha.5

### Patch Changes

- 🐛 **修复 weapp-vite + wevu 在微信小程序中的两类常见问题：** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9) by @sonofmagic
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

## 1.0.0-alpha.4

### Patch Changes

- 🐛 **补齐 Vue `<script setup>` 宏与运行时兼容能力：** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472) by @sonofmagic
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。

## 1.0.0-alpha.3

### Minor Changes

- [`32b44ae`](https://github.com/weapp-vite/weapp-vite/commit/32b44aef543b981f74389ee23e8ae2b7d4ecd2af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 补齐 Page 页面事件 hooks，并增强 `features` 用途：
  - `features` 用于**按需注入**页面事件处理函数（仍保持默认不注入，避免无效事件派发带来的性能与 UI 影响）。当你只在 `setup()` 里注册 hook 时，可通过 `features` 显式开启对应页面事件（例如 `onShareTimeline` 需要在注册阶段存在才会展示菜单按钮）。
  - 新增页面 hooks：`onLoad`、`onPullDownRefresh`、`onReachBottom`。
  - 新增文档 `docs/wevu/page-hooks-mapping.md`，提供 wevu hooks 与原生 Page 生命周期/事件回调的 1:1 对应表。

### Patch Changes

- [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

- [`7af6104`](https://github.com/weapp-vite/weapp-vite/commit/7af6104c5a4ddec0808f7336766adadae3c3801e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 补齐组件 `lifetimes/pageLifetimes` 的 hook 派发能力：
  - wevu：新增 `onMoved` / `onError` / `onResize`，分别对应 `lifetimes.moved` / `lifetimes.error` / `pageLifetimes.resize`。
  - 文档：补充 `defineComponent` 组件侧 lifetimes/pageLifetimes → wevu hooks 对照表。

## 1.0.0-alpha.2

### Minor Changes

- [`96a5161`](https://github.com/weapp-vite/weapp-vite/commit/96a516176d98344b4c1d5d9b70504b0032d138c9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增响应式批处理与作用域能力：
  - 新增 `batch`/`startBatch`/`endBatch`，支持将同一同步批次内的多次状态变更合并触发，减少重复 effect 执行。
  - 新增 `effectScope`/`onScopeDispose`/`getCurrentScope`，并让 `watch`/`watchEffect` 自动注册到作用域中，便于统一销毁与避免内存泄漏。
  - 修复 `watchEffect` 初始化时可能重复执行的问题（现在仅执行一次以建立依赖）。

### Patch Changes

- [`e2fdc64`](https://github.com/weapp-vite/weapp-vite/commit/e2fdc643dc7224f398b4a21e2d3f55dec310dd8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 `setup` 返回非可序列化对象导致小程序端更新栈溢出的问题：
  - 当 `setup/script setup` 返回值中包含小程序实例等复杂对象时，运行时不再将其纳入 `setData` 快照（改为非枚举属性，仅供 JS 侧访问），避免序列化/遍历时出现 `Maximum call stack size exceeded`。

- [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

## 1.0.0-alpha.1

### Major Changes

- [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

### Patch Changes

- [`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

## 0.0.2-alpha.0

### Patch Changes

- [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完善 wevu store 的类型推导对齐 Pinia，并补齐 tsd 测试覆盖。

- [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完善 wevu 运行时的健壮性与中文注释：补齐 runtime methods/state 兜底避免空指针，同时为响应式、生命周期、store 等源码补充详细中文说明，方便阅读和调试。

## 0.0.1

### Patch Changes

- [`d48b954`](https://github.com/weapp-vite/weapp-vite/commit/d48b954569142923b8956e75c344edcbdc020ad7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 运行时现在在调用 `createApp/defineComponent` 时直接注册原生实例，同时补充文档与示例说明新的无感挂载方式。
