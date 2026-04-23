# @weapp-core/constants

## 0.1.2

### Patch Changes

- 🐛 **为 `import.meta.env` 调试稳定性补充共享缓存 key 常量，供 `weapp-vite` 在页面与组件产物中复用同一份 env 表达式，减少调试输出行号漂移。** [#495](https://github.com/weapp-vite/weapp-vite/pull/495) by @sonofmagic

## 0.1.1

### Patch Changes

- 🐛 **修复 `weapp-vite` 等公开包对 `@weapp-core/constants` 发布依赖被锁定为精确版本的问题，并补充 constants 包变更必须带 changeset 的发布校验，避免共享常量新增导出后用户安装到旧版 constants 产物时出现运行时报错。** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446) by @sonofmagic

## 0.1.0

### Minor Changes

- ✨ **新增 `@weapp-core/constants` 包，用于沉淀可同时被 Node 侧构建流程、小程序运行时代码以及测试复用的共享常量；同时将请求全局对象注入与 app prelude 相关的内部私有命名迁移到该包统一管理，缩短 guard key、共享字段和 helper 标识符，减少最终构建产物中的冗长内部字段名，同时保持原有运行时行为与兼容性不变。** [`db65791`](https://github.com/weapp-vite/weapp-vite/commit/db65791b4d042b3090d3f4eecae30d2cc6ca7da5) by @sonofmagic
