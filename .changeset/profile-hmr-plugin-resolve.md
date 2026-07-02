---
"weapp-vite": patch
"create-weapp-vite": patch
---

补充 HMR profile 的插件 resolve 阶段统计，在 JSONL、`wv analyze --hmr-profile`、IDE 摘要和基准报告中展示 weapp-vite 插件 resolve hook 的耗时与调用次数，便于继续拆解 Rolldown/Vite core rebuild 的剩余成本。
