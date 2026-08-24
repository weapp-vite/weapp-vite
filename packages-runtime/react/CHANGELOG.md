# @weapp-vite/react

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
