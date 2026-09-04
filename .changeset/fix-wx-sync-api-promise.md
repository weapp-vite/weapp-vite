---
'@weapp-core/api': patch
'@wevu/api': patch
---

修复微信同步返回 API 被错误 Promise 化的问题，补齐无 `Sync` 后缀 API 的运行时与类型契约。
