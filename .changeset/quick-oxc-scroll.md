---
"@weapp-vite/ast": patch
---

修正 Oxc 引擎下 `onPageScroll` 性能诊断的遍历边界，避免重复扫描已命中的回调体，并跳过嵌套函数声明中的调用，降低 HMR 热路径上的无效 AST 遍历。
