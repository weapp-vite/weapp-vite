---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR 输出收尾阶段的 chunk 裁剪，减少写出前对 bundle 的重复遍历。
