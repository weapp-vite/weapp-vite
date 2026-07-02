---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR 缓存命中路径，只有在源码发生变化且可能走 style-only 刷新时才计算 style-independent signature，避免无变化缓存命中前触发额外的 SFC 解析或 native 签名调用。
