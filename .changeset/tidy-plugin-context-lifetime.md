---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复连续构建和 HMR 快照结束后，页面匹配缓存、Vue 编译选项及输出提交回调继续持有已结束构建上下文的问题，让这些缓存与待提交状态遵循所属构建的生命周期。
