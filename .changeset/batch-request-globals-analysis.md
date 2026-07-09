---
"weapp-vite": patch
"create-weapp-vite": patch
---

合并请求全局对象 auto 模式的 AST 分析，减少 HMR/load/transform 热路径中同一份源码的重复 Babel parse 与 traverse。
