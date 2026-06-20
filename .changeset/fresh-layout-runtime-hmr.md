---
"weapp-vite": patch
---

修复页面在 HMR 后引用 `weapp-vendors/*runtime*.js` 时，运行时 vendor chunk 被增量裁剪导致微信开发者工具报 “module is not defined” 的问题。
