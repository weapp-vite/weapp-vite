---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 dev HMR 输出裁剪流程，对不属于当前事件的旧 chunk 提前跳过 source 快照与缓存写入，减少 partial HMR 尾段的无效序列化开销。
