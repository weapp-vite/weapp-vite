---
'wevu': patch
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

修复 `wevu` 中 `setPageLayout()` 在页面 `watch` / `watchEffect` 回调里调用时可能丢失页面上下文的问题。现在页面实例会更早挂载 layout setter，响应式监听回调也会恢复创建时的当前实例；同时 `setPageLayout()` 会优先回退到运行时维护的当前页面实例，使 `setup()` 内部的 `immediate` watcher 以及后续响应式切换都能稳定驱动 layout 更新。同步更新 TDesign wevu 模板中的 store-layout 演示页，重新使用 watcher 驱动 `setPageLayout()` 以覆盖这一场景。
