---
"@wevu/compiler": patch
"wevu": patch
"create-weapp-vite": patch
---

Wevu 组件现在默认支持 SFC 编译器可静态识别的函数 prop 绑定路径，可在迁移 Vue/原生小程序组件时直接使用 `:callback="fn"`；成员路径函数 prop 会被提升为稳定的运行时绑定后再传入小程序组件，避免 `:handler="handlers.save"` 在 DevTools 中退化为普通对象。动态绑定或手写组件仍可通过 `allowFunctionProps: true` 全量放行，`allowFunctionProps: false` 可显式关闭。
