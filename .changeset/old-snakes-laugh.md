---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 `weapp-vite` 内置的 web API 注入入口正式调整为 `weapp-vite/web-apis`，并移除旧的 `weapp-vite/requestGlobals` 子路径导出。
