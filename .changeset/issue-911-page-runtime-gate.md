---
'wevu': patch
'create-weapp-vite': patch
---

完善首屏异步路由守卫门控，确保页面 setup、created、beforeMount、ready 和 mounted 生命周期均在 app-level 守卫完成后执行，并覆盖页面生命周期重入与守卫拒绝场景。
