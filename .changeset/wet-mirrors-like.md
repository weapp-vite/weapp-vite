---
"weapp-vite": patch
---

修复开发模式下自动路由 HMR 更新 app 脚本时，部分平台可能未将 `app.js` 作为本轮 HMR 输出保留，导致新增路由已经进入 `app.json` 但 `globalData` 里的自动路由数据仍然滞后的问题。
