---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

补充 `useSlots()` 的小程序端最小可用语义：编译器会基于组件来源为 wevu/Vue SFC 组件调用注入内部 `vue-slots` 元数据，支持 `<my-card>` 这类 kebab-case 写法，运行时据此恢复可枚举的 slots 对象，让 `Object.keys(useSlots())`、`useSlots().header` 与模板中的 `$slots.header` 可以判断普通插槽是否存在。没有编译期 slot 元数据时仍返回冻结的空 slots 对象；`<template #slot v-if="expr">` 会同步把条件映射到 slot 元数据和原生 fallback 内容上；TDesign 等原生小程序组件仍避免注入该内部属性。
