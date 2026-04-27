---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

补充 `useSlots()` 的小程序端最小可用语义：编译器会为 PascalCase/wevu 组件调用注入内部 `vue-slots` 元数据，运行时据此恢复可枚举的 slots 对象，让 `Object.keys(useSlots())`、`useSlots().header` 与模板中的 `$slots.header` 可以判断普通插槽是否存在。`<template #slot v-if="expr">` 会同步把条件映射到 slot 元数据和原生 fallback 内容上；kebab-case 小程序组件仍避免注入该内部属性。
