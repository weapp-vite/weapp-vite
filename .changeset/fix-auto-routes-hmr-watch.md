---
'weapp-vite': patch
---

修复自动路由 HMR 监听：新增 chokidar 文件监听补偿 Rolldown watcher 不触发新建文件的 watchChange 事件，同时在 `updateCandidateFromFile` 中对 `create` 和 `delete` 事件触发全量重扫，确保路由文件增删后 typed-router 和 app.json 能正确同步更新。
