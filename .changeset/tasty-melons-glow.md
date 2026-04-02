---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复了 `weapp-vite/requestGlobals` 子路径导出缺失的问题，避免依赖 request globals 注入的项目在构建时出现模块解析失败。
