---
title: wevu 概览
---

# wevu 概览

`wevu` 是一个面向小程序（以微信小程序为主）的轻量运行时：提供 Vue 3 风格的响应式（`ref/reactive/computed/watch`）、基于快照 diff 的最小化 `setData` 更新，以及类 Pinia 的状态管理（Store）。

它不引入 Virtual DOM，不改变小程序“数据驱动 + 模板渲染”的基本模型；你仍然写 WXML/ WXSS（或配合 weapp-vite 使用 Vue SFC 编写模板/样式/配置），但业务逻辑可以用熟悉的 Composition API 组织起来。

## 诞生的小故事

- 我最初想叫 `wevue`（weapp + vue），但 npm 已被占用，于是缩写成了 **wevu**。
- 当时为 `weapp-vite` 补齐 Vue SFC 支持时，我尝试嫁接社区的 `vue-mini`。在调研之后发现编译器与运行时都需要大改，于是放弃并自己写了 `wevu` 来适配编译侧。
- 借鉴 Vue 3.6 讨论的 `alien-signals` 思路，并把多小程序平台适配也一并考虑，最终形成了现在的 `wevu`。

## 你会用到的能力

- **响应式与调度**：与 Vue 3 相同心智的 `ref` / `reactive` / `computed` / `watch` / `watchEffect`，更新通过微任务批量调度（`nextTick`）。
- **页面/组件注册**：`defineComponent()` 统一通过小程序 `Component()` 注册；`createApp()` 可在存在全局 `App()` 时自动注册应用；`createWevuComponent()` 供 weapp-vite 编译产物调用。
- **最小化 setData**：运行时把 state + computed 转为 plain snapshot，diff 后只把变化路径传给 `setData`。
- **双向绑定辅助**：`bindModel(path)` 生成适配小程序事件的数据/事件绑定对象。
- **Store（状态管理）**：`defineStore` / `storeToRefs` / `createStore`（可选插件入口）。

:::tip 导入约定
所有 API 都从 `wevu` 主入口导入；不支持 `wevu/store`、`wevu/runtime` 等子路径。
:::

接下来可以按顺序阅读：

- 快速上手：`/wevu/quick-start`
- 运行时 API：`/wevu/runtime`
- defineComponent（组件）：`/wevu/component`
- Store：`/wevu/store`
- 兼容性与注意事项：`/wevu/compatibility`
- Vue 3 兼容性说明（完整）：`/wevu/vue3-compat`
- wevu vs Vue 3（核心差异）：`/wevu/vue3-vs-wevu`
