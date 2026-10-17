---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 在 Web HMR 扫描前刷新共享路由并失效应用配置缓存，确保删除后恢复的页面在重载前完成入口注册。
