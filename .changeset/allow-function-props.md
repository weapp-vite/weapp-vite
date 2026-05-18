---
"wevu": patch
"create-weapp-vite": patch
---

Wevu 组件新增 `allowFunctionProps` 显式开关，允许迁移 Vue 组件时把 data/setup 中的函数作为 prop 传递；默认仍过滤函数并优先推荐使用事件通信。
