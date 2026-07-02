---
"weapp-vite": patch
"create-weapp-vite": patch
---

补充 HMR profile 的 build-start 阶段统计，在 JSONL、`wv analyze --hmr-profile`、CLI 摘要和基准报告中单独展示 Vite/Rolldown buildStart 前置成本，便于区分插件准备耗时与核心构建耗时。
