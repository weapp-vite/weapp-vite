---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 组件 `<slot>` 兜底内容在小程序端无法按父组件是否传入插槽正确显示的问题。编译器现在会基于合法的 `vue-slots` 数组元信息生成显式条件分支，避免宿主 `<slot>` 原生 fallback 行为不一致。
