---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 项目在开发态修改 layout 或其他入口触发 HMR 后，`app.js` 可能保留裸 `require("wevu")`，导致微信开发者工具报 `module 'wevu.js' is not defined` 的问题。
