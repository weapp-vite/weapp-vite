---
"@weapp-vite/volar": patch
---

修复 vue-tsc 使用精简 TypeScript AST 时 JSON 脚本块映射崩溃，正确保留表达式位置和周围源码。
