# wevu

## 1.0.0-alpha.1

### Major Changes

- [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<config>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

### Patch Changes

- [`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

## 0.0.2-alpha.0

### Patch Changes

- [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完善 wevu store 的类型推导对齐 Pinia，并补齐 tsd 测试覆盖。

- [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完善 wevu 运行时的健壮性与中文注释：补齐 runtime methods/state 兜底避免空指针，同时为响应式、生命周期、store 等源码补充详细中文说明，方便阅读和调试。

## 0.0.1

### Patch Changes

- [`d48b954`](https://github.com/weapp-vite/weapp-vite/commit/d48b954569142923b8956e75c344edcbdc020ad7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 运行时现在在调用 `createApp/defineComponent` 时直接注册原生实例，同时补充文档与示例说明新的无感挂载方式。
