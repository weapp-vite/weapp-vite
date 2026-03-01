---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite/auto-routes` 在页面运行时代码中被别名解析到源码入口时可能触发 Rolldown 崩溃的问题。现在无论通过包名还是别名路径导入，都会统一走 auto-routes 虚拟模块；同时补充相关单测与 `auto-routes-define-app-json` 运行时 e2e 覆盖，确保首页导航链接可稳定渲染。
