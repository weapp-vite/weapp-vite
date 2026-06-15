---
"@weapp-vite/ast": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR 热路径中的 AST 预检逻辑，减少组件属性和页面特性分析在无关源码上的 Babel/Oxc 解析开销，并为 HMR lab 增加 Babel/Oxc 引擎横向对比报告能力。
