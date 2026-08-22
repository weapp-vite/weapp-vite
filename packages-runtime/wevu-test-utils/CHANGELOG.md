# @wevu/test-utils

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
