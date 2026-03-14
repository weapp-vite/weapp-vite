---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `auto-routes` 在 dev watch 模式下的 sidecar watcher 启动时机，避免仅在虚拟模块加载后才开始监听，导致使用 `defineAppJson` 或运行时代码引用 auto-routes 时新增页面文件无法触发 typed-router、`app.json` 和 `app.js` 的 HMR 更新。
