---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 wevu 运行时 shared chunk 在开发增量构建中可能从 `wevu-src.js` 漂移到 `wevu-store-C.js`，导致微信开发者工具仍执行旧页面模块时找不到 `weapp-vendors/wevu-src.js` 的问题。现在包含 wevu 核心运行时的合并 chunk 会优先保持 `wevu-src.js` 稳定命名，降低热更新后旧模块引用悬空的风险。
