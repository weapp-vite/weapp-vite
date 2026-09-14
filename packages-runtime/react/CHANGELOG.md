# @weapp-vite/react

## 0.2.6

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @weapp-core/constants@0.2.3

## 0.2.5

### Patch Changes

- 同步更新对 `@weapp-core/constants` 的依赖版本，使国际化、React、Web 运行时与测试工具使用本轮修复所需的公共运行时常量。

- 重构 Wevu 可选运行时能力的安装边界：编译产物会按模板元数据和应用选项显式安装所需能力，未使用 patch、模板 ref、内联事件、高频告警、作用域插槽或 layout 的小程序不再携带对应实现；公开 `wevu` 入口继续保留原有动态配置行为。

  能力分析沿用配置初始化表达式所属的词法作用域，不再被调用位置的同名局部变量误导；提取后的作用域插槽组件也会依据自身 layout host 元数据安装 layout 能力。

  按需 patch 与 diff 共用宿主提交跟踪，保证 setData 派发期间新增的 computed 变更不会丢失；清空模板 ref 绑定时会使旧异步查询失效，避免实例 `$nextTick` 读到已移除的引用。

- Updated dependencies:
  - @weapp-core/constants@0.2.2

## 0.2.4

### Patch Changes

- 收敛小程序运行时兼容边界：React static bindings 不再依赖 `Object.fromEntries`，simulator 补齐 `toolInfo()`、隔离 headless evaluator 的 Node/浏览器宿主全局，并对齐微信开发者工具的 `switchTab` 成功回调与页面栈提交顺序，Wevu 页面路由状态可通过 setup instance bridge 正确识别当前原生页面；同时隔离 stateful HMR snapshot 的产物缓存，确保重复文件事件下样式更新仍由最新 snapshot 正确提交。

## 0.2.3

### Patch Changes

- Updated dependencies:
  - @weapp-core/constants@0.2.1

## 0.2.2

### Patch Changes

- 将包主页、随包文档、脚手架默认链接与小程序 JSON Schema 地址统一迁移到 `vite.weapp.dev`，确保新生成项目和公开元数据使用新的文档主域名。

## 0.2.1

### Patch Changes

- 同步共享常量依赖版本，确保相关公开包可以与 Wevu 样式运行时能力一起发布。

- 新增可脱离 Vite 使用的 `@weapp-vite/i18n` 运行时、编译器、原生 catalog 命令和微信构建 npm 入口。运行时统一采用 `createI18n()` 工厂实例和 `i18n.global`，通过 `i18n.behavior` 接入组件、通过 `i18n.page()` 适配传统 Page，并移除未发布的旧 singleton 入口；weapp-vite 同时提供 locale JSON 扫描校验、简单占位符预编译、WXS 模板改写、HMR，以及主包、普通分包和独立分包的资产与实例边界。

- Updated dependencies:
  - @weapp-core/constants@0.2.0

## 0.2.0

### Minor Changes

- ✨ **新增 React 19 小程序运行时、React JSX 构建配置和 React 项目模板，支持可选的 SWC React Compiler，并支持 React、Wevu 与原生组件通过动态 props、自定义事件和默认插槽双向互操作。** [#718](https://github.com/weapp-vite/weapp-vite/pull/718) by @sonofmagic

### Patch Changes

- 🐛 **修复 React 运行时包缺少公开发布声明导致 npm 将其按私有包发布并返回 402 的问题。** [`e3ba674`](https://github.com/weapp-vite/weapp-vite/commit/e3ba6740d89bba6dd7ff995b1bf4e46fa5a21a5f) by @sonofmagic
- 📦 **Dependencies** [`e5a8f23`](https://github.com/weapp-vite/weapp-vite/commit/e5a8f23e9bdceadaaebc0c9d747303ba221b42b8)
  → `@weapp-core/constants@0.1.17`
