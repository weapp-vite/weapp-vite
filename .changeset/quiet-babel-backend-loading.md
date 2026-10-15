---
'@weapp-vite/ast': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

fix(ast): 修复 Babel 8 后端按需导入与同步 AST 分析并发时的模块加载竞争，保持同步分析接口和未使用后端的按需加载行为。
