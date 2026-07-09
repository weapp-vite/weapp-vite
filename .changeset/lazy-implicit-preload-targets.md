---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化隐式页面 preload 清理逻辑，只有 require chunk 实际命中页面 chunk 时才创建目标集合，减少生成阶段的无效分配。
