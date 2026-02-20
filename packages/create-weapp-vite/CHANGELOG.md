# create-weapp-vite

## 2.0.32

### Patch Changes

- 🐛 **新增 `wevu-retail` 模板选项，并接入 `weapp-vite-wevu-tailwindcss-tdesign-retail-template`。该模板基于零售场景重构为 wevu Vue SFC + weapp-tailwindcss + mokup 风格数据结构，覆盖主包与分包页面骨架，便于快速创建可访问的零售类小程序工程。** [`d504f5a`](https://github.com/weapp-vite/weapp-vite/commit/d504f5aaa192712c5baa181985dc6e0538bdcee9) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在 Vue SFC 模板中引用外部 `wxs` 文件时的产物缺失问题：调整 `wxs` 资源收集与发射时机，补充对 `generateBundle` 阶段 `wxml` 资产的依赖扫描，并兼容 `wxs` / `sjs` / `import-sjs` 标签，确保 `<wxs ... />` 与 `<wxs ...></wxs>` 两种写法均可自动输出到 `dist`。** [`8af1a5d`](https://github.com/weapp-vite/weapp-vite/commit/8af1a5defdb8fe0f662c0d203032867d4500eee0) by @sonofmagic
  - 同时移除 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中的 `copy-wxs-sidecar` 构建兜底插件，改为完全依赖 `weapp-vite` 核心链路自动处理 `wxml` 引入的 `wxs` 文件，避免模板侧重复拷贝逻辑。

- 🐛 **修复 `wevu` 模板编译在小程序端对可选链表达式（`?.`）的兼容性问题：在模板编译阶段将 `?.` 安全降级为条件表达式，避免产物 WXML 在微信开发者工具中出现语法报错，并补充对应编译测试与集成测试覆盖。** [`3f1253e`](https://github.com/weapp-vite/weapp-vite/commit/3f1253e5bd1dbb320566e869d172048c63265a56) by @sonofmagic
  - 同时对 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 进行路由与页面结构对齐：同步主包与分包路由配置至 `tdesign-miniprogram-starter-retail`，补齐自定义 `tabBar` 形态，并将页面壳改为按路由渲染对应版式（如首页、分类、购物车、商品详情、订单列表与表单页等），确保新建项目默认页面可访问且排版语义更接近原零售模板。

## 2.0.31

### Patch Changes

- 🐛 **修复了 dev 模式下新增 SFC 组件可能无法被自动引入及时识别的问题，并补充自动引入与热更新的多平台集成测试覆盖（weapp、alipay、tt），确保页面首次引用新增组件时 `usingComponents` 能稳定更新。与此同时在 CI 中新增对应的平台矩阵任务，持续防止该类回归。** [`69bc2a2`](https://github.com/weapp-vite/weapp-vite/commit/69bc2a20a13a1752e245938d32c8cdd7040e2dbc) by @sonofmagic

- 🐛 **修复分包之间共享 chunk 的跨包引用问题：当分包 `common.js` 被其他分包引用时，构建阶段会在目标分包生成本地副本并重写 `rolldown-runtime.js` 与其他静态依赖路径，避免微信开发者工具运行时报出 `module is not defined`。** [`972cc30`](https://github.com/weapp-vite/weapp-vite/commit/972cc3006f35383d61e0df444c4890495a7fcef8) by @sonofmagic
  - 同时补充 `tdesign-miniprogram-starter-retail` 全页面可访问的 IDE E2E 用例，并增强分类侧栏组件在子组件解绑场景下的方法调用容错，确保默认配置下页面访问更稳定。

- 🐛 **修复分包页面在微信开发者工具中可能出现 `rolldown-runtime.js` 跨包引用失败的问题。构建时会为相关分包生成本地 runtime 并重写引用路径，避免出现“module is not defined”类报错，提升分包项目在真机与开发者工具中的运行稳定性。** [`d945975`](https://github.com/weapp-vite/weapp-vite/commit/d945975553c443054a2e5fae8881d7337705abd8) by @sonofmagic

## 2.0.30

### Patch Changes

- 🐛 **修复 wevu 与 weapp-vite 在 `v-for` 场景下内联事件对象参数的响应式丢失问题：`@tap="updateQuantity(item, -1)"` 传入的 `item` 会恢复为源列表引用，方法内直接修改对象字段可正确触发视图更新。同时补齐 patch 模式下对 ref/reactive 子根变更的调度与回退映射，避免事件逻辑执行但 UI 不刷新的情况。** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903) by @sonofmagic

## 2.0.29

### Patch Changes

- 🐛 **修复 `auto-routes` 生成类型与 `defineAppJson` 的兼容性问题：`AutoRoutesPages`、`AutoRoutesEntries`、`AutoRoutesSubPackages` 改为非 `readonly` tuple，同时保持路由字面量推断精度，确保 `defineAppJson({ pages: routes.pages })` 在 TypeScript 下无需 `as string[]` 即可通过类型检查。** [`093a939`](https://github.com/weapp-vite/weapp-vite/commit/093a93932ff4424e30f4a8c4c100ccafba41aa09) by @sonofmagic
  补充对应回归测试：
  - 新增 `auto-routes` d.ts 生成器单元测试，覆盖 tuple 输出与 `readonly` 回归。
  - 新增 `tsd` 用例，覆盖默认导入与具名导入，并校验非法 `pages` 类型报错。
  - 新增 e2e fixture 与构建/类型检查用例，验证 `weapp-vite build`、`vue-tsc --noEmit` 及产物 `app.json` 路由内容。

- 🐛 **修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d) by @sonofmagic
  - 同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。

## 2.0.28

### Patch Changes

- 🐛 **fix(wevu)：修复 store `direct` 通知在订阅回调内二次修改状态时可能出现的重入更新风暴问题，避免小程序模拟器长时间无响应；同时补充 `wevu-features` 的 `use-store` 能力展示与对应 e2e 回归覆盖，提升交互稳定性与可验证性。** [`8d2d7f7`](https://github.com/weapp-vite/weapp-vite/commit/8d2d7f7e72d3da5a10fa14e5b66370f739eaf752) by @sonofmagic

- 🐛 **docs(wevu)：补充 wevu 特性展示与 e2e 覆盖，并明确 `useAttrs`、`useSlots`、`defineSlots` 在小程序平台的兼容边界与使用建议。** [`05e5517`](https://github.com/weapp-vite/weapp-vite/commit/05e55174e73c93c69bc28f6d651841161697a425) by @sonofmagic

- 🐛 **fix(wevu)：修复组件 attrs 同步会混入运行时 state 字段的问题，避免 attrs 透传被内部字段污染；同时将 runtime e2e 页面中的 `<text selectable>` 调整为 `user-select` 以消除平台弃用告警。** [`8916fc1`](https://github.com/weapp-vite/weapp-vite/commit/8916fc121800ad0da417cfe1e584b33d20094cc7) by @sonofmagic

- 🐛 **fix(wevu)：修复 runtime watch 停止句柄与注册流程的类型不一致问题，清理小程序全局对象与生命周期补丁的 TS 报错，并补全对外 API 的 tsd 与导出覆盖测试。** [`3af0847`](https://github.com/weapp-vite/weapp-vite/commit/3af0847c326a374cddd1bed283a1f24c4a2358ba) by @sonofmagic

## 2.0.27

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

## 2.0.26

### Patch Changes

- 🐛 **fix class/style runtime stability for dynamic class expressions and scoped-slot v-for cases** [`2be2749`](https://github.com/weapp-vite/weapp-vite/commit/2be27498a498fb1e85c5533cc521eb42bdad2ba8) by @sonofmagic
  - 为 class/style 的 JS 运行时计算增加表达式异常保护，避免在 `v-if` 守卫与列表项暂不可用时中断渲染
  - 修复 scoped slot 虚拟模块在 class 计算代码中缺失 `unref` 导入的问题
  - 补充相关单元测试与 e2e 回归用例，覆盖 `v-for` 动态 class 与 `root.a` 这类场景

## 2.0.25

### Patch Changes

- 🐛 **将 Vue 模板 `:class` / `:style` 的默认运行时从 `auto` 调整为 `js`，减少“WXS 模式下表达式级回退到 JS”带来的行为分岔，提升不同表达式形态下的一致性与可预期性。** [`65f9f13`](https://github.com/weapp-vite/weapp-vite/commit/65f9f131549181dcb23ac3f2767970663bd6c3c7) by @sonofmagic
  同时保留 `auto` / `wxs` 可选策略：
  - `auto` 仍会在平台支持 WXS 时优先使用 WXS，否则回退 JS。
  - `wxs` 在平台不支持时仍会回退 JS 并输出告警。

  更新了对应的配置类型注释与文档示例，明确默认值为 `js`。

## 2.0.24

### Patch Changes

- 🐛 **fix: weapp-vite open 场景在微信登录失效时增加友好提示与按键重试。** [`0e27865`](https://github.com/weapp-vite/weapp-vite/commit/0e2786529c0b3280d1682a0707d131c2ec65fb23) by @sonofmagic
  - `weapp-vite dev -o` / `weapp-vite open` 调用 IDE 时，命中 `code: 10` 或 `需要重新登录` 会给出明确提示。
  - 支持按 `r` 重试，按 `q`、`Esc` 或 `Ctrl+C` 取消。
  - 补充 `openIde` 与重试辅助函数单元测试，覆盖重试成功、取消和非登录错误分支。

- 🐛 **refactor: 提炼微信 IDE 登录失效重试逻辑，减少跨包重复实现。** [`ff78c39`](https://github.com/weapp-vite/weapp-vite/commit/ff78c394a29766497a7da57f46a2b394fbfc82d6) by @sonofmagic
  - `weapp-ide-cli` 对外导出登录失效识别与按键重试 helper。
  - `weapp-vite` 的 `open/dev -o` 逻辑改为复用 `weapp-ide-cli` helper，不再维护重复副本。
  - 清理 `weapp-vite` 本地重复重试模块，并更新单测 mock 到统一导出入口。

- 🐛 **feat: 统一 CLI 终端染色入口到 logger colors。** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41) by @sonofmagic
  - `@weapp-core/logger` 新增 `colors` 导出（基于 `picocolors`），作为统一终端染色能力。
  - 对齐 `packages/*/src/logger.ts` 适配层，统一通过本地 `logger` 入口透传 `colors`。
  - 后续 CLI 代码可统一使用 `from '../logger'`（或 `@weapp-core/logger`）进行染色，避免分散依赖与手写 ANSI。
  - 本次发布包含 `weapp-vite`，同步 bump `create-weapp-vite` 以保持脚手架依赖一致性。

- 🐛 **fix: 支持小程序事件修饰符 `.stop` 并完善修饰符校验与测试矩阵。** [`eef1eec`](https://github.com/weapp-vite/weapp-vite/commit/eef1eec1a5d73feaa8e82a74ebf4b5d7270159aa) by @sonofmagic
  - 模板编译器将 `@tap.stop` 视为阻止冒泡语义，输出 `catchtap`（含捕获组合输出 `capture-catch:tap`）。
  - WXML 扫描链路同步支持 `.stop`，与 `.catch/.capture/.mut` 前缀决策保持一致。
  - ESLint `vue/valid-v-on` 放行 weapp 场景常用修饰符，避免 `@tap.catch/@tap.mut/@tap.capture` 误报。
  - 补充编译与扫描单元测试矩阵，覆盖 `stop/catch/capture/mut` 及与 Vue 常见修饰符组合场景。

- 🐛 **fix: 修复 WeappIntrinsicElements 属性合并导致 `id` 推断为 `undefined` 的问题。** [`24f4d06`](https://github.com/weapp-vite/weapp-vite/commit/24f4d06d09986d48a56660d04481e44bb68afe5a) by @sonofmagic
  - 生成器跳过与基础属性（`id/class/style/hidden`）同名的组件属性，避免交叉类型冲突。
  - 基础属性 `id` 调整为 `string | number`，使 `map` 等场景可同时接收字符串与数字。
  - 补充 `tsd` 回归测试，验证 `WeappIntrinsicElements['map']['id']` 为 `string | number | undefined`。

- 🐛 **chore: 统一 CLI 中优先级输出风格与终端染色。** [`51735d0`](https://github.com/weapp-vite/weapp-vite/commit/51735d05925951eb9dc99a5f88a555178f845021) by @sonofmagic
  - `weapp-ide-cli`：补齐 `colors` 相关测试 mock，确保配置解析与 `minidev` 安装提示在新增染色后行为稳定。
  - `weapp-vite`：对齐 `openIde` 重试提示日志级别（`error/warn/info`），并统一通过 `logger.colors` 做重点信息高亮。
  - `weapp-vite`：优化运行目标、构建完成、分析结果写入等高频输出，统一命令/路径/URL 的染色展示。
  - 包含 `weapp-vite` 变更，按仓库约定同步 bump `create-weapp-vite`。

- 🐛 **fix: 优化 CLI 高优先级输出一致性与机器可读性。** [`5bc7afb`](https://github.com/weapp-vite/weapp-vite/commit/5bc7afb8ad3a425334f3d348bd86162184bbdfcf) by @sonofmagic
  - `weapp-vite analyze --json` 在 JSON 输出模式下默认静默平台提示，避免污染标准输出。
  - `weapp-vite open` 登录失效重试提示改为复用 `weapp-ide-cli` 的统一格式化 helper。
  - `create-weapp-vite` CLI 错误输出改为统一 logger，并区分“取消创建”和“创建失败”。
- 📦 **Dependencies** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41)
  → `@weapp-core/logger@3.1.0`

## 2.0.23

### Patch Changes

- 🐛 **fix(alipay): 兼容 antd-mini 文档的 `antd-mini/es/*` 组件路径。** [`fcb33fb`](https://github.com/weapp-vite/weapp-vite/commit/fcb33fbfaea80fb590427a56e5111b3e67fe7112) by @sonofmagic
  - 支付宝 `node_modules` npm 模式下，miniprogram 包构建时会同步复制包内 `es/` 目录到产物，避免 `usingComponents` 指向 `antd-mini/es/*` 时找不到组件文件。
  - 修复支付宝 npm 缓存命中时的重建判定：当源包存在 `es/` 但缓存产物缺失时，会自动触发重建，避免继续复用旧产物。
  - `alipay-antd-mini-demo` 示例切换为 antd-mini 文档一致写法：`usingComponents` 使用 `antd-mini/es/Button/index`。

- 🐛 **fix: 修复多平台（尤其支付宝）编译兼容与 `wpi` 注入问题。** [`89acadd`](https://github.com/weapp-vite/weapp-vite/commit/89acadd1016f14b1df249a13989ae2791fa4e43e) by @sonofmagic
  - 模板转换增强：支付宝产物支持 `wx:* -> a:*`、`bind/catch` 事件映射到 `on*/catch*`，并将 PascalCase 组件标签与 `usingComponents` key 归一化为 kebab-case。
  - JS 目标兼容增强：支付宝在未显式配置 `build.target` 时默认降级到 `es2015`，避免可选链等语法在开发者工具中报错。
  - `injectWeapi` 注入增强：在显式开启 `replaceWx: true` 时，编译阶段自动把 `wx/my` API 调用重写为统一 `wpi` 访问，且运行时不再依赖 `globalThis`，兼容支付宝环境。
  - 默认行为保持不变：`injectWeapi.replaceWx` 仍默认关闭，需要在项目中显式开启。

- 🐛 **fix: 修复 class/style helper 在微信与支付宝脚本模块语法差异下的兼容回归。** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6) by @sonofmagic
  - `@wevu/compiler` 的 class/style helper 改为按脚本扩展名分支生成：
    - `.wxs` 保持 `module.exports`、`Array.isArray` 与 `String.fromCharCode` 路径，恢复微信端行为。
    - `.sjs` 继续使用 `export default`，并避免 `Array` / `String.fromCharCode` 等在支付宝 SJS 下受限的标识符。
  - `weapp-vite` 补充对应单测断言，分别覆盖 `wxs` 与 `sjs` helper 输出约束。
  - 在 `e2e-apps/wevu-runtime-e2e` 新增 `pages/class-style/index.vue`，补充 class/style 多形态绑定示例，并同步 `weapp/alipay/tt` e2e 快照，防止后续回归。

- 🐛 **fix: `injectWeapi` 不再生成 `weapp-vite.weapi.d.ts`，并将 `wpi` 全局类型并入 `weapp-vite/client`，避免用户手动修改 `tsconfig` include。** [`685cd70`](https://github.com/weapp-vite/weapp-vite/commit/685cd70a59c05f6054ee61d81b814b7cdc57c48a) by @sonofmagic

- 🐛 **fix: 修复支付宝平台 npm 构建与 scoped slot 兼容问题。** [`2cf1f5c`](https://github.com/weapp-vite/weapp-vite/commit/2cf1f5c73a80c5d2f9c1c22aa396a1c47f599e02) by @sonofmagic
  - 支付宝平台下对小程序 npm 包增加稳定转换：模板后缀/语法映射、ESM 到 CJS 转换、嵌套依赖提升与缓存自修复，避免 `cannot resolve module`、`unknown is outside of the project` 等报错。
  - 支付宝平台下为 `componentGenerics` 自动补齐默认占位组件，并在构建产物中自动发出占位组件文件，修复 `componentGenerics ... 必须配置默认自定义组件`。
  - 优化 scoped slot 子组件 `usingComponents` 收敛逻辑，仅保留模板实际依赖，减少无效引用与平台差异问题。

- 🐛 **feat: 支持支付宝平台 npm 目录策略切换，并默认使用 `node_modules`。** [`28123ac`](https://github.com/weapp-vite/weapp-vite/commit/28123acad176ced6ea6ace113ac0161a2bf49115) by @sonofmagic
  - 新增 `weapp.npm.alipayNpmMode` 配置，支持 `node_modules` 与 `miniprogram_npm` 两种模式。
  - 默认策略切换为 `node_modules`，更贴近支付宝小程序 npm 管理语义。
  - 统一支付宝平台 `usingComponents` 与 JS `require` 的 npm 引用改写逻辑，确保与目录策略一致。
  - npm 构建与输出清理流程按策略保留对应目录，避免缓存与产物目录错配。

- 🐛 **fix(alipay): 避免运行时直接访问 `globalThis` 导致支付宝端报错。** [`aabec69`](https://github.com/weapp-vite/weapp-vite/commit/aabec69b7e543d092113b377af1a552d623553e5) by @sonofmagic
  - wevu 运行时在自动注册 App、页面生命周期补丁与 scoped-slot 全局注入场景，改为优先使用小程序全局对象（`wx`/`my`），避免在关键路径直接访问 `globalThis`。
  - 修复支付宝模拟器中 `ReferenceError: globalThis is not defined`，兼容不提供 `globalThis` 的运行环境。

- 🐛 **feat: 支持支付宝平台一键打开 IDE，并优化 lib-mode 测试产物稳定性。** [`f46e69c`](https://github.com/weapp-vite/weapp-vite/commit/f46e69cbb7c6aef720d1ace6aa58916e0d28dc1a) by @sonofmagic
  - `weapp-ide-cli` 新增 `open --platform alipay` 分流能力，自动转发到 `minidev ide`。
  - `weapp-vite` 新增 `open --platform <platform>`，且在 `dev/build --open -p alipay` 场景自动走支付宝 IDE 打开链路。
  - `weapp-vite` 的 `injectWeapi` 在 app 注入阶段新增原生平台 API 兜底探测，避免支付宝环境下 `wpi` 未绑定原生 `my` 导致 `setClipboardData:fail method not supported`。
  - `weapp-vite` 在多平台模式下针对支付宝平台优化 npm 输出目录推导：若未手动配置 `packNpmRelationList`，会基于 `mini.project.json` 的 `miniprogramRoot` 计算 npm 输出目录，避免 npm 产物错误写入项目根目录。
  - `weapp-vite` 的 `lib-mode` 测试改为写入临时输出目录，避免每次单测改写 fixture 内的 `.d.ts` 文件。

- 🐛 **feat: 完善支付宝示例与模板脚本模块兼容。** [`b474b9a`](https://github.com/weapp-vite/weapp-vite/commit/b474b9ade95d3430c11256f41d665bc14e268875) by @sonofmagic
  - 在 `apps/alipay-antd-mini-demo` 新增 wevu SFC 页面示例，并补充首页跳转入口。
  - 修复支付宝模板脚本模块标签转换，统一输出 `import-sjs` 并映射 `from/name` 属性，避免开发者工具报 `<sjs>` 不存在。
  - 同步完善 wxml/nmp builder 相关测试，覆盖支付宝脚本模块转换链路。

## 2.0.22

### Patch Changes

- 🐛 **支持在 App 入口可选注入 @wevu/api 的 wpi，且仅在启用时生成全局类型提示与可选 wx 替换配置（默认关闭，需显式开启）。** [`21e2d6f`](https://github.com/weapp-vite/weapp-vite/commit/21e2d6f2eec95502a0eb6e4f0d911a327e180478) by @sonofmagic

- 🐛 **lib 模式默认生成 dts，支持 .vue/wevu SFC，并修复 rolldown dts 输出命名冲突；新增 internal 模式生成 Vue SFC dts（vue-tsc 作为可选后备），同时导出 WevuComponentConstructor 以保障声明生成。** [`7ac4a68`](https://github.com/weapp-vite/weapp-vite/commit/7ac4a688e88e21192cf0806ca041db0773ac3506) by @sonofmagic

## 2.0.21

### Patch Changes

- 🐛 **调整 lib 模板的 dev/dev:open 脚本与默认 AppID 配置。** [`22590cf`](https://github.com/weapp-vite/weapp-vite/commit/22590cf1bcfd4fb0db3c5d17de869528c634383e) by @sonofmagic

## 2.0.20

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@weapp-core/logger@3.0.3`

## 2.0.19

### Patch Changes

- 🐛 **新增 weapp-vite-lib-template 组件库模板。** [`d804756`](https://github.com/weapp-vite/weapp-vite/commit/d80475675ffad8fff1c363858d1eed4238b3440b) by @sonofmagic

- 🐛 **升级多处依赖版本（Babel 7.29、oxc-parser 0.112、@vitejs/plugin-vue 6.0.4 等）。** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628) by @sonofmagic
  - 同步模板与示例的 tdesign-miniprogram、weapp-tailwindcss、autoprefixer 等版本，确保脚手架默认依赖一致。

- 🐛 **Miscellaneous improvements** [`c4d3abb`](https://github.com/weapp-vite/weapp-vite/commit/c4d3abb8e4642dc38fa9a47efc7ac26b41703db1) by @sonofmagic
  - 新增共享 chunk 的配置能力，并在构建阶段仅使用 rolldown（忽略 rollupOptions）。
  - web 插件在未扫描模板列表时也可直接转换 wxml。

- 🐛 **Miscellaneous improvements** [`737cc22`](https://github.com/weapp-vite/weapp-vite/commit/737cc220cd44cd0cf1ec6597fc80d1efbf47b9a1) by @sonofmagic
  - 新增 weapp.lib 库模式，用于按入口打包组件/模块，并支持自动生成组件 JSON。

## 2.0.18

### Patch Changes

- 🐛 **修复 Vue SFC `<style>` 中 `@import` 相对路径解析基准错误，确保按当前 SFC 目录解析。** [`2e218e6`](https://github.com/weapp-vite/weapp-vite/commit/2e218e69812a5795231b6e718daed585cd37f29f) by @sonofmagic

## 2.0.17

### Patch Changes

- 🐛 **修复 Windows 下 Vue `<style>` 请求带 `?query` 导致的路径读取错误，改用虚拟 ID 并在解析时还原真实路径。** [`eed307c`](https://github.com/weapp-vite/weapp-vite/commit/eed307c73c431809284a6515f1ee4fe977af2863) by @sonofmagic

## 2.0.16

### Patch Changes

- 🐛 **修复 Windows 下 .vue 样式虚拟请求解析导致的构建报错，并改进 /@fs 与路径分隔符处理（含 WXS/WXML 与缓存 key）以提升跨平台兼容性。** [`0d7f854`](https://github.com/weapp-vite/weapp-vite/commit/0d7f854d4bbcb544ada423137747a0a898e21308) by @sonofmagic

## 2.0.15

### Patch Changes

- 🐛 **升级依赖版本：rolldown 至 1.0.0-rc.2、vite 至 8.0.0-beta.10。** [`aca8b62`](https://github.com/weapp-vite/weapp-vite/commit/aca8b62241f1e735bb159c13c26d925718e81a3f) by @sonofmagic

- 🐛 **将 Vue SFC 与 wevu 编译逻辑迁移到 `@wevu/compiler`，由 `wevu/compiler` 统一导出，`weapp-vite` 改为使用新编译器入口并清理重复实现。** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce) by @sonofmagic

- 🐛 **为 wevu 的 watch/watchEffect 增加 pause 与 resume 能力，同时保持 stop 旧用法兼容。** [`d54d430`](https://github.com/weapp-vite/weapp-vite/commit/d54d430a93b8045f91ab1a16b2501dceda10a824) by @sonofmagic

- 🐛 **修复 watch/watchEffect 在同一微任务内重复触发的问题，确保调度去重生效。** [`7fc02cd`](https://github.com/weapp-vite/weapp-vite/commit/7fc02cd1fb7858358445b07bfd24f443b1a99ad3) by @sonofmagic

## 2.0.14

### Patch Changes

- 🐛 **支持内联事件参数使用动态表达式，并兼容小程序侧数组参数传递。** [`8940c7f`](https://github.com/weapp-vite/weapp-vite/commit/8940c7fd87b6153137ca9b33b8d0925a4b592c4e) by @sonofmagic

- 🐛 **支持内联事件表达式在编译期生成执行器，保证复杂参数调用在小程序运行时可用。** [`9c90f7b`](https://github.com/weapp-vite/weapp-vite/commit/9c90f7b6777374aaf54ee4b5955a4b01209acc0f) by @sonofmagic

- 🐛 **修复作用域插槽生成规则与样式隔离默认值，更新 e2e 运行与展示配置并补齐小程序类型定义。** [`53c2b8a`](https://github.com/weapp-vite/weapp-vite/commit/53c2b8a5f25e59d621d6dac5018b56352aaa785f) by @sonofmagic

- 🐛 **修复内联事件表达式执行器在运行时读取不到 inline map 的问题，确保模板事件可正常触发。** [`fc5657e`](https://github.com/weapp-vite/weapp-vite/commit/fc5657e7c66c4150aba47829b48f5d38f797d797) by @sonofmagic

- 🐛 **修复组件化页面生命周期补触发逻辑，补齐下拉刷新/滚动事件，并避免生命周期日志丢失。** [`26bc05b`](https://github.com/weapp-vite/weapp-vite/commit/26bc05b47852aaf07c45e7528c60269dc36d1d9b) by @sonofmagic

## 2.0.13

### Patch Changes

- 🐛 **仅在 v-slot 传递作用域参数时生成 scoped slot 组件，普通具名插槽回退为原生 slot；新增 weapp.vue.template.scopedSlotsRequireProps 配置以切换旧行为。** [`a97099c`](https://github.com/weapp-vite/weapp-vite/commit/a97099cdfa28362b13481758405cda8961858b39) by @sonofmagic

- 🐛 **新增组件选项 `setupLifecycle`（`created` / `attached`），并将默认执行时机改为 `attached`，以便 setup 拿到外部传入的 props；同时 weapp-vite 类型对齐该配置。** [`5c42bd3`](https://github.com/weapp-vite/weapp-vite/commit/5c42bd34cac020dc6d6bd094b6b45e78cdb6a53c) by @sonofmagic

## 2.0.12

### Patch Changes

- 🐛 **补全 button 的 open-type 枚举与事件类型，并补充单元测试和 tsd 覆盖。** [`a6e3ba8`](https://github.com/weapp-vite/weapp-vite/commit/a6e3ba8be6c22dcfbf2edbfa9c977f8a39aef119) by @sonofmagic

- 🐛 **按组件拆分 weappIntrinsicElements 输出文件，并为每个组件文件补充文档链接注释。** [`d160032`](https://github.com/weapp-vite/weapp-vite/commit/d16003262a212070f1547db80ab2b7f7aecb8a83) by @sonofmagic

- 🐛 **稳定模板 watch rebuild 测试，避免复制 node_modules 触发随机失败，并补齐测试类型定义。** [`556d45d`](https://github.com/weapp-vite/weapp-vite/commit/556d45dc74a646da65046ad8dae4043ff53a6f26) by @sonofmagic

- 🐛 **修复 Windows 下脚本改动不触发热更新的问题，并补充模板 watch rebuild 测试。** [`50cae1b`](https://github.com/weapp-vite/weapp-vite/commit/50cae1b62e63d24cf7cdb2babf185a283af81b29) by @sonofmagic

## 2.0.11

### Patch Changes

- 🐛 **multiPlatform 改为使用 `config/<platform>/project.config.json` 目录约定，禁用 `--project-config` 覆盖，并在构建时同步复制平台配置目录到产物根目录。** [`3c9113d`](https://github.com/weapp-vite/weapp-vite/commit/3c9113d2945c1ebbece9f85b5b914ca975d2e837) by @sonofmagic

- 🐛 **新增 multiPlatform 多平台配置支持，允许按平台加载 `project.config` 并支持 `--project-config` 覆盖路径。** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373) by @sonofmagic
  - 补充 `LoggerConfig`/`WeappWebConfig` 的 JSDoc 示例，提升 IDE 提示体验。 避免 rolldown-require 在配置 `codeSplitting` 时触发 `inlineDynamicImports` 的警告。

- 🐛 **支持按平台读取对应的项目配置文件名（如 `mini.project.json`、`project.swan.json`），并同步多平台示例配置目录结构。** [`e56da93`](https://github.com/weapp-vite/weapp-vite/commit/e56da9360230735055c513f1e6b5a8bd99ad892e) by @sonofmagic

- 🐛 **对齐 `watch`/`watchEffect` 的 `flush`/`scheduler`/`once`/`deep:number` 行为与类型，并补充 `traverse` 分支覆盖；修复 rolldown-require 的类型构建错误。** [`28ea55d`](https://github.com/weapp-vite/weapp-vite/commit/28ea55d72429fd416502d80fa9819c099fe16dd3) by @sonofmagic

- 🐛 **修复多平台构建时 `dist` 输出与 `project.config` 同步路径不一致的问题，统一将 `miniprogramRoot=dist` 映射为 `dist/<platform>/dist` 并自动复制平台 `project.config`。** [`9a99f4c`](https://github.com/weapp-vite/weapp-vite/commit/9a99f4c4b249c97bf76733027307028f9c5c5d68) by @sonofmagic
  - 显式禁用 `inlineDynamicImports` 以避免 `codeSplitting` 下的警告。

- 🐛 **开发态构建结束后可自动 touch `app.wxss` 以触发微信开发者工具热重载（检测 weapp-tailwindcss）。** [`f428178`](https://github.com/weapp-vite/weapp-vite/commit/f428178aa44a07e48f33f5aaa9f5e875440bd6db) by @sonofmagic

- 🐛 **调整 Web 默认输出目录为 `dist/web`，并确保 Web 构建 `outDir` 不被小程序构建配置覆盖。** [`742eb8f`](https://github.com/weapp-vite/weapp-vite/commit/742eb8f321aa02cadac4ec3b91753d7cf8d653ce) by @sonofmagic
- 📦 **Dependencies** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373)
  → `@weapp-core/logger@3.0.2`

## 2.0.10

### Patch Changes

- 🐛 **完善多平台模板与脚本模块的输出后缀适配，并同步 JSON 产物扩展名处理。** [`31e4d25`](https://github.com/weapp-vite/weapp-vite/commit/31e4d2520f89e57bc1e06561c57351aa18f635bb) by @sonofmagic

## 2.0.9

### Patch Changes

- 🐛 **破坏性变更：`setup` 与 Vue 3 对齐，仅支持 `setup(props, ctx)`。请将 `setup(ctx)` 改为 `setup(_, ctx)`。** [`158306b`](https://github.com/weapp-vite/weapp-vite/commit/158306b75191040ecbdef846e66e9f6e49036d19) by @sonofmagic

## 2.0.8

### Patch Changes

- 🐛 **补充发布规则校验，确保依赖与模板更新时同步触发 create-weapp-vite 发布。** [`1c2fe4f`](https://github.com/weapp-vite/weapp-vite/commit/1c2fe4fbf65464515923ae9553fcf42941b81ddd) by @sonofmagic

## 2.0.7

### Patch Changes

- 🐛 **补充 wevu@1.2.0 的 Volar 类型依赖说明，避免脚手架用户对 `vue` 依赖产生误解。** [`2c407ba`](https://github.com/weapp-vite/weapp-vite/commit/2c407baf41954ccececeb4e04095f21aeb08b91d) by @sonofmagic

## 2.0.6

### Patch Changes

- 🐛 **同步模板配置，支持 `weapp.logger` 日志过滤能力。** [`8b094d0`](https://github.com/weapp-vite/weapp-vite/commit/8b094d0981c1e8122c1c6b5fba569479a5be59d4) by @sonofmagic
- 📦 **Dependencies** [`13703f5`](https://github.com/weapp-vite/weapp-vite/commit/13703f5ca6010df78f5d08a2a9d4dbed4c5ccea4)
  → `@weapp-core/logger@3.0.1`

## 2.0.5

### Patch Changes

- 🐛 **优化 wevu + tailwindcss + TDesign 模板：提炼通用 hooks/utils 与类型复用。** [`b17a4ce`](https://github.com/weapp-vite/weapp-vite/commit/b17a4cec352430638a67691ab28920ad735316b4) by @sonofmagic

## 2.0.4

### Patch Changes

- 🐛 **更新模板组件的 props 定义，统一使用 `defineProps<T>() + withDefaults` 写法。** [`db07d38`](https://github.com/weapp-vite/weapp-vite/commit/db07d3836a2e842ac387c6f11f0225e92f31a300) by @sonofmagic

## 2.0.3

### Patch Changes

- 🐛 **更新 wevu 模板的 typecheck 脚本，统一使用 `tsconfig.app.json` 并补充 `vue-tsc` 依赖。** [`571a28d`](https://github.com/weapp-vite/weapp-vite/commit/571a28decda0ed67738bb33b87c6a56bf6dade97) by @sonofmagic

## 2.0.2

### Patch Changes

- 🐛 **chore: 同步模板** [`d613292`](https://github.com/weapp-vite/weapp-vite/commit/d61329235b999ccd207816886bb4cdbf5d32d826) by @sonofmagic

## 2.0.1

### Patch Changes

- 🐛 **修复：创建项目时将模板中的 workspace 依赖改为 ^ 版本范围（weapp-vite/wevu）。** [`86e5882`](https://github.com/weapp-vite/weapp-vite/commit/86e58822f4d82e82f840179b9cc8826fd3e81dd3) by @sonofmagic

## 2.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

### Patch Changes

- 📦 **Dependencies** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)
  → `@weapp-core/logger@3.0.0`

## 1.3.7

### Patch Changes

- 🐛 **chore: update template** [`3e10fc7`](https://github.com/weapp-vite/weapp-vite/commit/3e10fc76b34e5f40b411365bce784bde6cebadff) by @sonofmagic

## 1.3.6

### Patch Changes

- 🐛 **fix: weapp-vite 和 weapp-tailwindcss 依赖了不同版本的 Vite 类导致类型不匹配 ts 类型报错** [`66247be`](https://github.com/weapp-vite/weapp-vite/commit/66247be326609433a10468da04310f0b318add61) by @sonofmagic

## 1.3.5

### Patch Changes

- 🐛 **chore: 更新模板** [`fcbbf78`](https://github.com/weapp-vite/weapp-vite/commit/fcbbf7893f701538b3bd2a3975aa903fbea653b0) by @sonofmagic

## 1.3.4

### Patch Changes

- 🐛 **chore(deps): upgrade** [`b6d5f0e`](https://github.com/weapp-vite/weapp-vite/commit/b6d5f0e6e26c76b78462d0a335d4da7341b8d969) by @sonofmagic

## 1.3.3

### Patch Changes

- 🐛 **chore: 更新初始模板** [`b4b0371`](https://github.com/weapp-vite/weapp-vite/commit/b4b03718bee9f1864c0606ca29e0a34210f14dc2) by @sonofmagic

## 1.3.2

### Patch Changes

- 🐛 **chore(deps): upgrade** [`9260af8`](https://github.com/weapp-vite/weapp-vite/commit/9260af8561ad47b55f2b6084be7f2b039c5d523c) by @sonofmagic

## 1.3.1

### Patch Changes

- 🐛 **chore(deps): upgrade** [`b78c8d2`](https://github.com/weapp-vite/weapp-vite/commit/b78c8d2cc151fd7862cf485ebcae976023b785ad) by @sonofmagic

## 1.3.0

### Minor Changes

- ✨ **## 变更说明** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa) by @sonofmagic
  - `weapp-vite` CLI 移除 `create` 命令；新项目创建请使用 `create-weapp-vite`（例如 `pnpm create weapp-vite`）。
  - `@weapp-core/init` 仅保留“初始化配置文件”相关能力（如 `initConfig`），不再包含模板项目创建能力。
  - 模板同步与模板创建逻辑迁移到 `create-weapp-vite`，并对外导出 `createProject` / `TemplateName`。

## 1.2.1

### Patch Changes

- 📦 **Dependencies** [`c02b412`](https://github.com/weapp-vite/weapp-vite/commit/c02b41283cb4862891e85750b72c9937a339f4fe)
  → `@weapp-core/init@4.1.1`

## 1.2.0

### Minor Changes

- ✨ **新增 `wevu-tdesign` 模板可选项（对应 `templates/weapp-vite-wevu-tailwindcss-tdesign-template`），可通过 `@weapp-core/init` 与 `create-weapp-vite` 选择创建。** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76)
  → `@weapp-core/init@4.1.0`

## 1.1.5

### Patch Changes

- 📦 **Dependencies** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63)
  → `@weapp-core/init@4.0.1`

## 1.1.4

### Patch Changes

- 🐛 **修复 `create-weapp-vite` 交互式模板列表未展示 `wevu` 模板的问题，并在发布前自动构建 `dist`，避免新模板选项遗漏。** [`16eb095`](https://github.com/weapp-vite/weapp-vite/commit/16eb095702a9ee60bc326268ae736cfc82e2775e) by @sonofmagic

## 1.1.3

### Patch Changes

- 📦 **Dependencies** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7)
  → `@weapp-core/init@4.0.0`

## 1.1.3-alpha.1

### Patch Changes

- 📦 **Dependencies** [`b34b972`](https://github.com/weapp-vite/weapp-vite/commit/b34b972610bbceb7ed1ad1e9dddb689b0909390e)
  → `@weapp-core/init@3.0.8-alpha.1`

## 1.1.3-alpha.0

### Patch Changes

- Updated dependencies [[`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59)]:
  - @weapp-core/init@3.0.8-alpha.0

## 1.1.2

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44)]:
  - @weapp-core/init@3.0.7

## 1.1.1

### Patch Changes

- [`6e4dd84`](https://github.com/weapp-vite/weapp-vite/commit/6e4dd8483e6ec7b42cbcd9c8ea067fbc07969506) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82)]:
  - @weapp-core/init@3.0.6

## 1.1.0

### Minor Changes

- [`835d07a`](https://github.com/weapp-vite/weapp-vite/commit/835d07a2a0bbd26a968ef11658977cbfed576354) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

### Patch Changes

- Updated dependencies [[`ec736cd`](https://github.com/weapp-vite/weapp-vite/commit/ec736cd433fa344c7d10a96efe8af4ee899ba36b)]:
  - @weapp-core/init@3.0.5

## 1.0.24

### Patch Changes

- Updated dependencies [[`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec)]:
  - @weapp-core/init@3.0.4

## 1.0.23

### Patch Changes

- [`0259a17`](https://github.com/weapp-vite/weapp-vite/commit/0259a17018527d52df727c098045e208c048f476) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

- Updated dependencies [[`8bdcc85`](https://github.com/weapp-vite/weapp-vite/commit/8bdcc858b2f967c4b96ec997536c0ad5c8157aa7)]:
  - @weapp-core/init@3.0.3

## 1.0.22

### Patch Changes

- Updated dependencies [[`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823)]:
  - @weapp-core/init@3.0.2

## 1.0.21

### Patch Changes

- [`84fc3cc`](https://github.com/weapp-vite/weapp-vite/commit/84fc3cc1e04169e49878f85825a3c02c057337fb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

## 1.0.20

### Patch Changes

- Updated dependencies [[`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f)]:
  - @weapp-core/init@3.0.1

## 1.0.19

### Patch Changes

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547)]:
  - @weapp-core/init@3.0.0

## 1.0.19-alpha.0

### Patch Changes

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547)]:
  - @weapp-core/init@3.0.0-alpha.0

## 1.0.18

### Patch Changes

- Updated dependencies [[`576c8e1`](https://github.com/weapp-vite/weapp-vite/commit/576c8e1f5a143031ed3c321bf25a8e66a0d8c043), [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048)]:
  - @weapp-core/init@2.1.5

## 1.0.17

### Patch Changes

- [`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745)]:
  - @weapp-core/init@2.1.4

## 1.0.16

### Patch Changes

- Updated dependencies [[`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a), [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f)]:
  - @weapp-core/init@2.1.3

## 1.0.15

### Patch Changes

- Updated dependencies [[`3f0b3a2`](https://github.com/weapp-vite/weapp-vite/commit/3f0b3a2fb8dfbb83cd83e3b005ab3e9ccd2d4480)]:
  - @weapp-core/init@2.1.2

## 1.0.14

### Patch Changes

- Updated dependencies [[`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e)]:
  - @weapp-core/init@2.1.1

## 1.0.13

### Patch Changes

- Updated dependencies [[`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a)]:
  - @weapp-core/init@2.1.0

## 1.0.12

### Patch Changes

- Updated dependencies [[`2144ba3`](https://github.com/weapp-vite/weapp-vite/commit/2144ba3b8ae4ffd753f4bef8dab1e15553ac01fb)]:
  - @weapp-core/init@2.0.10

## 1.0.11

### Patch Changes

- [`0cbd148`](https://github.com/weapp-vite/weapp-vite/commit/0cbd14877233fefd86720a818e1b9e79a7c3eb68) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持配置使用 jsonc 格式

## 1.0.10

### Patch Changes

- Updated dependencies [[`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273), [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122), [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f)]:
  - @weapp-core/init@2.0.9

## 1.0.9

### Patch Changes

- Updated dependencies [[`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431), [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839)]:
  - @weapp-core/init@2.0.8

## 1.0.8

### Patch Changes

- [`9a2a21f`](https://github.com/weapp-vite/weapp-vite/commit/9a2a21f8c472aeb95a0192983275eddc85f5f37b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.7

### Patch Changes

- Updated dependencies [[`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1)]:
  - @weapp-core/init@2.0.7

## 1.0.6

### Patch Changes

- Updated dependencies [[`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821)]:
  - @weapp-core/init@2.0.6

## 1.0.5

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

- Updated dependencies [[`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2), [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72)]:
  - @weapp-core/init@2.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [[`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e)]:
  - @weapp-core/init@2.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [[`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d)]:
  - @weapp-core/init@2.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [[`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1), [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51)]:
  - @weapp-core/init@2.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @weapp-core/init@2.0.1

## 1.0.0

### Major Changes

- [`5199d06`](https://github.com/weapp-vite/weapp-vite/commit/5199d06f3fc4b0162115004953a55d87746a4563) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 发布 create-weapp-vite 正式版本

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef), [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4)]:
  - @weapp-core/init@2.0.0

## 0.0.13-beta.0

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef)]:
  - @weapp-core/init@2.0.0-beta.0

## 0.0.12

### Patch Changes

- Updated dependencies [[`8c61a0f`](https://github.com/weapp-vite/weapp-vite/commit/8c61a0fb12298b90cf0f0aeebcea8d42aa2afd3a)]:
  - @weapp-core/init@1.2.2

## 0.0.11

### Patch Changes

- Updated dependencies [[`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc)]:
  - @weapp-core/init@1.2.1

## 0.0.10

### Patch Changes

- Updated dependencies [[`1401bed`](https://github.com/weapp-vite/weapp-vite/commit/1401bedf00f722b1f03917b02481aafa456ac129)]:
  - @weapp-core/init@1.2.0

## 0.0.9

### Patch Changes

- Updated dependencies [[`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b)]:
  - @weapp-core/init@1.1.18

## 0.0.8

### Patch Changes

- Updated dependencies [[`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0), [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d)]:
  - @weapp-core/init@1.1.17

## 0.0.7

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`4907eae`](https://github.com/weapp-vite/weapp-vite/commit/4907eae52e0c5f3399c1468a0688f69a99f61f95), [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81)]:
  - @weapp-core/init@1.1.16

## 0.0.6

### Patch Changes

- [`a10af03`](https://github.com/weapp-vite/weapp-vite/commit/a10af03b0e85326cb9db344af6ebed027b1e5a89) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade deps

## 0.0.5

### Patch Changes

- [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change default template

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04), [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204), [`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2), [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020), [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35), [`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15

## 0.0.5-alpha.5

### Patch Changes

- Updated dependencies [[`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2)]:
  - @weapp-core/init@1.1.15-alpha.5

## 0.0.5-alpha.4

### Patch Changes

- Updated dependencies [[`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15-alpha.4

## 0.0.5-alpha.3

### Patch Changes

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04)]:
  - @weapp-core/init@1.1.15-alpha.3

## 0.0.5-alpha.2

### Patch Changes

- Updated dependencies [[`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35)]:
  - @weapp-core/init@1.1.15-alpha.2

## 0.0.5-alpha.1

### Patch Changes

- [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change default template

- Updated dependencies [[`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020)]:
  - @weapp-core/init@1.1.15-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies [[`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204)]:
  - @weapp-core/init@1.1.15-alpha.0

## 0.0.4

### Patch Changes

- Updated dependencies [[`8ddfc97`](https://github.com/weapp-vite/weapp-vite/commit/8ddfc97a5706a25fa146b10fa43b7dc626a9f893)]:
  - @weapp-core/init@1.1.14

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @weapp-core/init@1.1.13

## 0.0.2

### Patch Changes

- [`6858172`](https://github.com/weapp-vite/weapp-vite/commit/6858172f22ef429374d6165390a2d1a018132441) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: create-weapp-vite allow select template

- Updated dependencies [[`c2f29a1`](https://github.com/weapp-vite/weapp-vite/commit/c2f29a15a651389175fbe7cb5c6e1644bcaafd1c), [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af)]:
  - @weapp-core/init@1.1.12

## 0.0.1

### Patch Changes

- Updated dependencies [[`5735e56`](https://github.com/weapp-vite/weapp-vite/commit/5735e5651a793611489afbbd7982241b6792f8fc)]:
  - @weapp-core/init@1.1.11
