---
"wevu": patch
"create-weapp-vite": patch
---

修复 Wevu Vue SFC 页面通过 `definePageJson({ enablePullDownRefresh: true })` 启用下拉刷新后，直接注册的 `onPullDownRefresh` 在微信开发者工具用户下拉刷新路径中不会触发的问题。
