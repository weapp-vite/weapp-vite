---
title: wevu 概览
---

# wevu 概览

`wevu` 是一个面向小程序（以微信小程序为主）的轻量运行时。可以把它看作“把 Vue 3 的响应式心智模型带到小程序里”，但不引入 Virtual DOM，而是用快照 diff 来尽量减少 `setData` 的更新量。

它主要提供：

- Vue 3 风格的响应式（`ref` / `reactive` / `computed` / `watch`）
- 基于快照 diff 的最小化 `setData` 更新
- 类 Pinia 的 Store（状态管理）

wevu 不改变小程序“数据驱动 + 模板渲染”的基本模型：你仍然写 WXML/WXSS（或配合 weapp-vite 用 Vue SFC 编写模板/样式/配置），但业务逻辑可以用熟悉的 Composition API 组织起来。

## wevu 在整套体系里的位置

如果你同时使用 weapp-vite 的 Vue SFC：

- **weapp-vite（编译期）**：把 `.vue` 编译成 WXML/WXSS/JS/JSON，并做模板语法转换。
- **wevu（运行期）**：负责响应式、生命周期 hooks、快照 diff 与最小化 `setData`。

因此遇到问题时可以快速分层定位：

- “模板/指令/usingComponents/v-model 怎么编译？” → 先看 `/wevu/vue-sfc`
- “状态为什么不更新 / hooks 为什么不触发？” → 先看 `/wevu/runtime` 与 `/wevu/compatibility`

## 诞生的小故事

这段背景不影响使用，你可以先跳过：

- 最初想叫 `wevue`（weapp + vue），但 npm 已被占用，于是缩写成了 `wevu`。
- 在为 `weapp-vite` 补齐 Vue SFC 支持时，调研过社区方案（如 `vue-mini`），但编译器与运行时都需要大改，最后选择自己实现以更贴合小程序。
- 借鉴 Vue 3 的响应式设计思路，并考虑多小程序平台适配，逐步形成现在的 wevu。

## 你会用到的能力

- **响应式与调度**：与 Vue 3 相同心智的 `ref` / `reactive` / `computed` / `watch` / `watchEffect`，更新通过微任务批量调度（`nextTick`）。
- **页面/组件注册**：`defineComponent()` 统一通过小程序 `Component()` 注册；`createApp()` 可在存在全局 `App()` 时自动注册应用；`createWevuComponent()` 供 weapp-vite 编译产物调用。
- **最小化 setData**：运行时把 state + computed 转为 plain snapshot，diff 后只把变化路径传给 `setData`。
- **双向绑定辅助**：`bindModel(path)` 生成适配小程序事件的数据/事件绑定对象。
- **Store（状态管理）**：`defineStore` / `storeToRefs` / `createStore`（可选插件入口）。

:::tip 导入约定
运行时 API 都从 `wevu` 主入口导入。`wevu/compiler` 仅供 weapp-vite 等编译侧工具使用（非稳定用户 API）。
:::

## 编译侧桥接（wevu/compiler）

`wevu/compiler` 用来承载 wevu 与编译工具之间的共享常量，避免在多个项目里重复写字符串：

- `WE_VU_MODULE_ID`：运行时入口模块名（`wevu`）。
- `WE_VU_RUNTIME_APIS`：运行时 API 名称集合（如 `createApp` / `defineComponent` / `createWevuComponent`）。
- `WE_VU_PAGE_HOOK_TO_FEATURE`：页面 hook 与 features 的映射表。

这些导出面向编译工具（例如 weapp-vite），应用代码不要依赖它们作为稳定 API。

## 推荐学习顺序（按“最短上手 → 深入理解”）

1. [快速上手](/wevu/quick-start)：先跑通一个页面/组件（含 store）
2. [运行时与生命周期](/wevu/runtime)：理解 `setup(props, ctx)`、生命周期 hooks、`bindModel`、watch 策略
3. [defineComponent（组件）](/wevu/component)：掌握组件字段透传、`properties/props`、`emit/expose` 等细节
4. [Store](/wevu/store)：落地状态管理（订阅、补丁、插件）
5. [兼容性与注意事项](/wevu/compatibility)：了解限制与边界（尤其是 provide/inject、页面事件按需派发）

接下来可以按顺序阅读：

- [快速上手](/wevu/quick-start)
- [运行时与生命周期](/wevu/runtime)
- [defineComponent（组件）](/wevu/component)
- [Store](/wevu/store)
- [API 参考总览](/wevu/api-reference/)
- [兼容性与注意事项](/wevu/compatibility)
- [Vue 3 兼容性说明（完整）](/wevu/vue3-compat)
- [wevu vs Vue 3（核心差异）](/wevu/vue3-vs-wevu)
