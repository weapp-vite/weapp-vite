---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `weapp.vue.template` 新增 `slotSingleRootNoWrapper` 配置，在 `<template v-slot>` 只有单个可挂载根节点时可直接把 `slot` 挂到该节点上，避免额外的 `<view>` 包裹；同时补齐编译器、类型与 github-issues 回归覆盖。
