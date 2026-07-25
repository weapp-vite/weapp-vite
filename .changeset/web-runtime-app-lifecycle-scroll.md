---
"@weapp-vite/web": minor
---

为 Web Runtime 补齐应用前后台生命周期与页面滚动所有权：首次页面挂载前触发 App 启动回调，浏览器可见性切换驱动 onHide/onShow，并让用户滚动、pageScrollTo 与浏览器历史恢复统一归属于当前页面栈项。
