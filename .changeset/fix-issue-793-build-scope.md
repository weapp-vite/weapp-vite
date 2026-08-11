---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `buildScope` 与自动路由分包识别冲突导致的分包页面被错误加入主包并参与构建的问题。
