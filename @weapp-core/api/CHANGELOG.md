# @weapp-core/api

## 0.3.1

### Patch Changes

- 修复微信同步返回 API 被错误 Promise 化的问题，补齐无 `Sync` 后缀 API 的运行时与类型契约。

## 0.3.0

### Minor Changes

- 新增类型安全的 Vitest API mock：支持通过 setup 子路径一次替换 `api` / `wpi`，也可使用独立 factory 与局部 reset；Promise、回调、同步和事件 API 均保留原类型契约，并同步提供 `@wevu/api` 与 `wevu/api` 兼容入口。

## 0.2.0

### Minor Changes

- 新增框架与运行时无关的 `@weapp-core/api` 多端小程序 API 代理包，支持内置宿主自动探测与显式 adapter 注入；`@wevu/api` 调整为兼容入口，继续保留 `wpi`、`createWeapi` 及既有类型导出。
