---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 metadata-only HMR 生成阶段的 chunk 判断，减少样式和模板热更新时对 bundle 的重复扫描。
