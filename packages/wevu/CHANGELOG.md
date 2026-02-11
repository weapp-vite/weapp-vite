# wevu

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
