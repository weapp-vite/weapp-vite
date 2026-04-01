---
'wevu': patch
'create-weapp-vite': patch
---

为 `wevu.createApp()` 增加 `app.onUnmount()` 与 `app.unmount()`，增强对 `@tanstack/vue-query` 等依赖应用级卸载钩子的 Vue 插件兼容性。
