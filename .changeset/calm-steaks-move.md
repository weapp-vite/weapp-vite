---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强开发态 HMR profile 的粗粒度阶段采样：新增 `buildCoreMs`、`transformMs`、`writeMs` 指标，并同步到 JSONL profile、`analyze --hmr-profile` 聚合结果与 IDE/CLI 摘要，便于定位热更新慢点是在核心构建、transform 还是写盘尾段。
