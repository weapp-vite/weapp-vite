---
'weapp-vite': patch
'create-weapp-vite': patch
'@weapp-vite/miniprogram-automator': patch
---

修复新版微信开发者工具中 automator 启动重复打开项目的问题，并支持按 npm 包配置复制文件范围，减少原生小程序组件库进入构建产物的无关文件和首次启动压力。
