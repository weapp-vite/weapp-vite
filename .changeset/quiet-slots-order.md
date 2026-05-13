---
"weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复组件同时包含隐式默认子节点和 `<template #name>` 具名插槽时，生成的小程序模板会把默认子节点移动到具名插槽之后的问题。现在 plain template slot 会按源码中的子节点顺序输出，同时保留原有的 `vue-slots` 元数据和作用域插槽生成逻辑。
