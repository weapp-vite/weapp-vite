---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享样式 import-only 输出阶段：先并发准备页面/组件样式导入内容，再按 chunk 顺序统一提交输出，避免并发阶段共享 emitted 状态带来的重复处理风险，并保持生成顺序稳定。
