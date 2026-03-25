---
'@weapp-vite/dashboard': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite` 新增 `--ui` 调试入口并保留 `--analyze` 兼容别名，同时将 dashboard 升级为单页多面板分析 UI，集中展示包体、分包、产物文件与跨包模块复用细节。
