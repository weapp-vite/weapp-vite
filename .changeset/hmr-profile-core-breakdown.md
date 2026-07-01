---
"weapp-vite": patch
"create-weapp-vite": patch
---

修正开发态 HMR profile 的 `buildCoreMs` 统计口径，不再把已单独计量的 transform、renderStart、generateBundle、emit 与写盘阶段重复计入 core 剩余耗时；同时让 analyze 与 CLI 摘要展示更细的 transform/generate 阶段，方便定位真实热更新瓶颈。
