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

`createStore()` 只设置全局活动 manager，插件必须在 Store 第一次创建前注册；`install()` 是 no-op，`useXxx()` 不接收 manager 参数。Wevu Store 不提供 Pinia SSR、HMR 或 devtools 契约。

## router

如果项目使用 `wevu/router`，优先把导航、route、参数解析看成小程序运行时约束下的路由抽象，而不是浏览器路由。

`currentRoute` 是 readonly 响应式对象而不是 `Ref`，`isReady()` 创建后立即完成；没有 Web history、`RouterView` 或 `RouterLink`，页面栈前进和 tabBar query 受宿主限制。

## 静态兼容检查

Wevu 模板默认接入 `@weapp-vite/eslint` 的 `wevuCompatibilityRecommended`，用于禁止静态可确定的不支持 API，并警告同名但参数、时序或宿主语义不同的 API。动态访问和第三方依赖内部代码不在完整判定范围内；旧项目可继续使用 `weapp-vite/eslint` 兼容入口。

## 什么时候看这篇

适用于：

- 页面/组件/store 的运行时行为
- 生命周期时序
- 事件契约
- `bindModel`
- `storeToRefs`

如果问题主轴是 `.vue` 宏或模板语法，继续看 [`vue-sfc.md`](./vue-sfc.md)。
