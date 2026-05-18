---
"wevu": patch
"create-weapp-vite": patch
---

Wevu 组件现在默认支持 SFC 编译器可静态识别的函数 prop 绑定路径，可在迁移 Vue/原生小程序组件时直接使用 `:callback="fn"`；动态绑定或手写组件仍可通过 `allowFunctionProps: true` 全量放行，`allowFunctionProps: false` 可显式关闭。
