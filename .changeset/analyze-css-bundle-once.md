---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 CSS 生成阶段的 bundle 分析流程，只为真实样式资源创建处理任务，减少 HMR 与构建中的无效输出遍历。
