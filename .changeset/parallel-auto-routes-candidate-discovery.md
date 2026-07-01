---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 auto-routes 增量更新时的候选入口重建流程，Vue、脚本、模板、样式和 JSON 侧文件会并行探测并保持原有候选归并顺序，减少页面文件变更后的 HMR 路由刷新等待。
