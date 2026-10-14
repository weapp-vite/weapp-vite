---
"@wevu/compiler": patch
---

perf(compiler): 普通 JS、TS 和 Vue SFC 编译按需加载 Vue JSX 转换器，减少无 JSX 构建的提前初始化开销，并保留 JSX、TSX 转换结果、错误传播和 sourcemap 行为。
