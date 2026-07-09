---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR 缓存复用逻辑：当重复 dirty 标记没有带来源码或自动路由签名变化时，复用已有编译结果并跳过重新编译，降低重复失效导致的 Vue transform 与 bundle refresh 成本。
