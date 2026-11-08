---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 修复 classic dev 辅助模块图重复执行第三方插件生命周期，以及增量重建丢失 `require.async` 分包目标和传递依赖的问题。补充分包 SQLite 的真实查询、稳定重建与删除恢复回归。
