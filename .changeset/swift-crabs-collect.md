---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 对 `wevu/web-apis` 子路径的工作区包解析与别名映射，避免在本地 workspace / demo app 中引用该子路径时被错误拼接成 `dist/index.mjs/web-apis` 一类无效路径。现在 `wevu/web-apis` 可以和 `wevu`、`wevu/fetch`、`wevu/router` 等子路径一样被稳定解析到对应 dist 入口，便于在小程序项目里直接引入新的 Web Runtime 安装函数与兼容层导出。
