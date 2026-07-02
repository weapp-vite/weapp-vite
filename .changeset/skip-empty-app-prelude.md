---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化默认无 app prelude 的生成流程，跳过不必要的 prelude 读取与 chunk 注入扫描，减少构建和 HMR 的固定开销。
