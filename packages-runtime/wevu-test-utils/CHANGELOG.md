# @wevu/test-utils

## 0.2.9

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.0.2
  - wevu@7.0.2

## 0.2.8

### Patch Changes

- Updated dependencies:
  - @weapp-core/constants@0.2.1
  - @wevu/compiler@7.0.1
  - wevu@7.0.1

## 0.2.7

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@7.0.0
  - wevu@7.0.0

## 0.2.6

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.25.1
  - wevu@6.25.1

## 0.2.5

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.25.0
  - wevu@6.25.0

## 0.2.4

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.24.0
  - wevu@6.24.0

## 0.2.3

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.23.0
  - wevu@6.23.0

## 0.2.2

### Patch Changes

- 同步共享常量依赖版本，确保相关公开包可以与 Wevu 样式运行时能力一起发布。

- 新增可脱离 Vite 使用的 `@weapp-vite/i18n` 运行时、编译器、原生 catalog 命令和微信构建 npm 入口。运行时统一采用 `createI18n()` 工厂实例和 `i18n.global`，通过 `i18n.behavior` 接入组件、通过 `i18n.page()` 适配传统 Page，并移除未发布的旧 singleton 入口；weapp-vite 同时提供 locale JSON 扫描校验、简单占位符预编译、WXS 模板改写、HMR，以及主包、普通分包和独立分包的资产与实例边界。

- Updated dependencies:
  - @weapp-core/constants@0.2.0
  - @wevu/compiler@6.22.0
  - wevu@6.22.0

## 0.2.1

### Patch Changes

- 隔离 `@wevu/test-utils` 每次组件挂载的应用上下文，避免 provide、插件、mocks 和卸载状态跨 wrapper 泄漏；同时允许测试页面目录内的普通组件，并支持自定义页面文件判定。

- 确保组件卸载生命周期抛出异常时仍会执行测试应用和插件的清理回调。

- Updated dependencies:
  - @wevu/compiler@6.21.0
  - wevu@6.21.0

## 0.2.0

### Minor Changes

- 扩展 `@wevu/test-utils`，新增 `wevuSfc()` Vitest 入口和 `mountComponent()`，可以直接导入真实 Vue SFC 并在不构建 WXML 的情况下测试 setup、props、data、computed、methods、watch、emits、provide/inject、响应式状态和生命周期。保留 `mountComposable` 兼容入口，并继续由 `@mpcore/test` 负责完整编译产物、WXML 查询和宿主交互。同步补充 Wevu 的不注册组件定义运行时入口，避免轻量测试污染小程序全局注册状态。

### Patch Changes

- Updated dependencies:
  - @wevu/compiler@6.20.5
  - wevu@6.20.5
