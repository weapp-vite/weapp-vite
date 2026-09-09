---
"weapp-vite": patch
"create-weapp-vite": patch
---

在逻辑入口加载成功时登记编译器发现的组件，使首次构建与后续快照使用一致的入口集合，避免无关模板更新触发完整重载。
