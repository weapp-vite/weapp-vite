---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 CSS import graph 同步，当同一个样式 importer 的依赖集合没有变化且反向索引仍一致时跳过 Map/Set 重写，减少 build/HMR 样式生成阶段的重复图维护开销。
