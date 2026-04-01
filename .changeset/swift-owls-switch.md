---
'wevu': patch
'create-weapp-vite': patch
---

优化 `wevu` 的依赖注入语义：当 `provide()` 在 app `setup()` 中调用时，现会自动同步为应用级全局注入，使 `app.vue` 可以直接使用普通 `provide()` 为页面和组件提供 app 级依赖，不再必须手动改用 `provideGlobal()`。
