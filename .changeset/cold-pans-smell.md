---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复开发态快捷键与小程序产物重建流程：将 `r` 调整为通知微信开发者工具重新编译当前项目，将手动重建产物改为 `R`，并修复 dev 重建清空 `dist` 后因 emit 缓存未失效导致 `app.json` 等产物未重新写回的问题。
