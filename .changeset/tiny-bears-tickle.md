---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 request runtime / request globals 在真实小程序构建产物中的按需注入回归。现在会为未显式导出的 installer 自动补稳定私有导出，确保页面入口、`app.prelude.js` 和独立 `request-globals-runtime.js` 都能拿到正确的安装函数，并把运行时覆盖补齐到 `wevu-runtime-demo`、Vue 版 request-clients、原生 request-clients 以及 app prelude 场景，避免 DevTools 真机链路中出现 `fetch`、`XMLHttpRequest` 或 `WebSocket` 未初始化的问题。
