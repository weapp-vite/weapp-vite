---
'wevu': patch
'create-weapp-vite': patch
---

修复 blocking 首屏导航守卫返回 redirect 时未执行宿主重定向、原始页面仍被挂载的问题。
