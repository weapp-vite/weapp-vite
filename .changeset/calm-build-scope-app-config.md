---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复局部构建后 `preloadRule`、`tabBar` 与默认启动页仍引用未参与构建页面或分包的问题，确保生成的 `app.json` 与本次构建范围保持一致。
