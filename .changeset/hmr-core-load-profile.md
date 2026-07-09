---
"weapp-vite": patch
"create-weapp-vite": patch
---

细化 HMR profile 中的 core load 阶段统计，新增入口加载、request globals 注入和 weapi 解析耗时；同时让未变脏的分包扫描复用缓存结果，减少 HMR rebuild options 阶段的固定计算。
