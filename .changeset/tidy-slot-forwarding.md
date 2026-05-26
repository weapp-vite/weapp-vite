---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复命名插槽中透传默认 `<slot />` 时生成无效 `<slot slot="...">` 的问题，改为保留可被微信小程序识别的容器投影结构，并支持通过全局配置或组件内静态属性为不同组件、不同具名插槽自定义 fallback wrapper。全局规则里的 `component` 匹配模板标签名，`componentName` 可匹配子组件静态 `defineOptions({ name })`，单个 slot 也可以把 `slot-wrapper` 写在 `<template #xxx>` 上就近覆盖。
