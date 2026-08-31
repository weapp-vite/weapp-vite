---
'wevu': patch
'create-weapp-vite': patch
---

修复 Wevu 小程序首次启动时未等待 `router.beforeEach` 异步守卫的问题，页面 runtime 现在会在首屏导航守卫完成后再挂载。
