---
'@weapp-vite/ast': minor
---

为 `@weapp-vite/ast` 新增 `collectJsxAutoComponentsFromCode` 共享分析能力，并让 `@wevu/compiler` 的 JSX 自动组件收集逻辑复用该公共实现。这样可以继续把 Babel/Oxc 双后端 AST 分析能力从业务包中抽离出来，减少重复实现并统一后续扩展入口。
