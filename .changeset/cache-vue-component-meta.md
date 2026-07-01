---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

优化 Vue SFC 编译中的组件静态元信息解析：同一个被引用的 Vue 组件现在会复用一次读取和解析结果，减少自动 using component 与自动导入标签路径上的重复 AST 处理。
