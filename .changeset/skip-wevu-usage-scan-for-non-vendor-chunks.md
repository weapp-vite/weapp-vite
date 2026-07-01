---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Wevu runtime 访问稳定化的使用量收集，先跳过不包含 `weapp-vendors/` 的 chunk，减少大多数无关产物上的正则扫描开销。
