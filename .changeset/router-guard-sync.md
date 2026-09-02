---
'wevu': patch
'create-weapp-vite': patch
---

修复路由托管导航与页面初始导航并发时重复执行全局守卫的问题，并去重迟到的宿主路由同步事件。
