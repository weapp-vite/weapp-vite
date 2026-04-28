---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR 在 source shared chunk 场景下的影响范围计算，避免普通 entry 直接改动被误扩散到同一 shared chunk 的全部入口，同时保留 partial refresh 中 shared chunk 源模块索引，确保共享源码变更仍能稳定命中相关入口。
