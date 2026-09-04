---
"wevu": minor
"@wevu/compiler": patch
"weapp-vite": patch
"@wevu/web-apis": patch
"create-weapp-vite": patch
---

新增适用于静态 WXML 数据绑定的 `useAsyncDerivation()`，统一首次加载、保留旧值刷新、错误、竞态取消与作用域销毁状态，并让根入口导入稳定路由到独立响应式产物。
