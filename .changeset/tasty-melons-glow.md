---
'weapp-vite': patch
'create-weapp-vite': patch
---

调整 `weapp-vite` 的 Web API 注入子路径导出，统一使用 `weapp-vite/web-apis` 入口，避免运行时注入模块解析与命名长期分叉。
