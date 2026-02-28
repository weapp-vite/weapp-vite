# @wevu/compiler

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
