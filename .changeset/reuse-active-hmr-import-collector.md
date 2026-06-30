---
"weapp-vite": patch
"create-weapp-vite": patch
---

复用 partial HMR 的 active import 收集逻辑，减少生成阶段为静态和动态 import 合并数组的临时分配。
