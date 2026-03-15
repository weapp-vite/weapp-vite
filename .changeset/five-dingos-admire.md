---
'@weapp-vite/ast': minor
---

为 `@weapp-vite/ast` 新增 Babel AST 只读节点辅助与 JSX 模块分析辅助，包括类型包裹表达式解包、对象静态属性读取，以及从 Babel AST 中提取 JSX 自动组件分析所需的导入组件和默认导出组件表达式，进一步减少 `@wevu/compiler` 中的重复 AST 分析实现。
