---
"@weapp-vite/ast": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `@weapp-vite/ast` 的 Babel `generate` 包装函数类型边界，避免消费方在依赖树中同时存在 Babel 7 与 Babel 8 RC 类型时出现 AST 节点类型不兼容，恢复 `weapp-vite` 包级 typecheck。
