---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 CSS 生成阶段的 bundle 分析复用，减少 HMR 与构建中样式 asset 和入口 chunk 的重复遍历。
