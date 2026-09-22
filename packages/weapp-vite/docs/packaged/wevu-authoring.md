# Wevu Authoring

这个文档聚焦在 weapp-vite 项目里最常见的 wevu 编写约束。

## 页面与组件

优先保持小程序语义，不要默认把 Vue Web 习惯直接搬进来。

建议：

- 生命周期在 `setup()` 内同步注册
- 状态优先使用 `ref` / `reactive`
- 事件契约保持明确、可序列化

## 生命周期

避免在 `await` 之后再注册页面或组件生命周期。

这类写法通常会导致时序错误或生命周期不触发。

## 事件与双向绑定

复杂表单或可复用字段组件优先使用 `bindModel` / `useBindModel`，不要让事件细节分散在大量不一致的自定义协议里。

## store

推荐：

- 小边界 store
- `storeToRefs`
- 避免巨型跨页面全局 store

Store 日常用法以 Pinia 4.0.3 为参照。先通过 `use(createPinia())` / `app.use(pinia)` 安装，或调用 `useXxx(pinia)`；外部 state 自动解包。`storeToRefs` 只返回响应式 state/getters，action 从 Store 直接解构。Setup 自行提供 `$reset`；`$dispose` 保留 manager 状态。插件接收 `{ store, pinia, app, options }`。推荐 `createPinia`；`createStore` 保留为同一个函数的兼容别名，`StoreManager` 类型继续保留。不提供 Web SSR、Pinia HMR 或 Vue Devtools。本次按 minor 发布，旧消费者仍需按 [PR 前后迁移指南](https://vite.weapp.dev/wevu/store-migration) 检查初始化、外部 ref、reset、订阅与插件。

## router

如果项目使用 `wevu/router`，优先把导航、route、参数解析看成小程序运行时约束下的路由抽象，而不是浏览器路由。

`currentRoute` 是 readonly 响应式对象而不是 `Ref`，`isReady()` 创建后立即完成；没有 Web history、`RouterView` 或 `RouterLink`，页面栈前进和 tabBar query 受宿主限制。

## 静态兼容检查

Wevu 项目应通过共享 ESLint 配置统一接入 `@weapp-vite/eslint` 的 `wevuCompatibilityRecommended` 与 `miniProgramRuntimeRecommended`，模板不要单独增加 workspace 依赖。前者检查 Vue 生态兼容性，后者禁止不可移植的 DOM/Node 全局和现代内建，并警告必须通过 `weapp.appPrelude.webRuntime` 或显式兼容层提供的 API。不要假定微信运行时存在 `queueMicrotask`；新增宿主 API 前要在目标真实 IDE AppService、基础库和 renderer 中探测。旧项目可继续使用 `weapp-vite/eslint` 兼容入口。

## 什么时候看这篇

适用于：

- 页面/组件/store 的运行时行为
- 生命周期时序
- 事件契约
- `bindModel`
- `storeToRefs`

如果问题主轴是 `.vue` 宏或模板语法，继续看 [`vue-sfc.md`](./vue-sfc.md)。
