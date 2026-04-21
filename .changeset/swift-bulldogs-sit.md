---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复托管 tsconfig 仍然回灌已弃用 `baseUrl` 的问题，并同步更新相关测试夹具，避免 TypeScript 6+ 持续报废弃诊断。
