---
'wevu': patch
'create-weapp-vite': patch
---

为 `wevu` 补充与 Vue 3 对齐的 `version` 兼容能力。现在既可以从 `wevu` 主入口直接导入 `version`，也可以通过 `createApp()` 返回的 app 实例读取 `app.version`；同时 `wevu/vue-demi` 改为复用 `wevu` 自身的版本导出，避免在 `vue -> wevu` alias 场景下继续直接引用 `vue` 而引发循环依赖。
