---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复分包页面在微信开发者工具中可能出现 `rolldown-runtime.js` 跨包引用失败的问题。构建时会为相关分包生成本地 runtime 并重写引用路径，避免出现“module is not defined”类报错，提升分包项目在真机与开发者工具中的运行稳定性。
