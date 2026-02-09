# @wevu/compiler

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
