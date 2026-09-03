---
'@mpcore/simulator': patch
'@weapp-vite/react': patch
'create-weapp-vite': patch
'wevu': patch
'weapp-vite': patch
---

收敛小程序运行时兼容边界：React static bindings 不再依赖 `Object.fromEntries`，simulator 补齐 `toolInfo()`、隔离 headless evaluator 的 Node/浏览器宿主全局，并对齐微信开发者工具的 `switchTab` 成功回调与页面栈提交顺序，Wevu 页面路由状态可通过 setup instance bridge 正确识别当前原生页面；同时隔离 stateful HMR snapshot 的产物缓存，确保重复文件事件下样式更新仍由最新 snapshot 正确提交。
