---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `weapp-vite analyze` 增加 `--hmr-profile` 模式，可读取文件型热更新生成的 JSONL profile 并输出聚合后的阶段耗时、事件分布、dirty/pending 原因和最慢样本，方便开发者直接定位热更新慢点。
