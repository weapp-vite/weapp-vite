---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化代表入口 HMR 刷新后的 dirty entry 清理，避免 shared chunk/source CSS 代表入口刷新后把已覆盖的旧 dirty entry 留到后续热更新事件中，减少长时间 dev 会话里的重复 pending 解析开销。
