---
"weapp-vite": patch
---

修复开发态 `weapp-vite/runtime` 在初次构建和 HMR 后产物形态不一致的问题。现在 dev 模式会从初次构建开始稳定产出 `weapp-vendors/weapp-vite-runtime.js`，避免页面脚本热更新后首次新增 runtime vendor 模块时，微信开发者工具出现 `module 'weapp-vendors/weapp-vite-runtime.js' is not defined`。
